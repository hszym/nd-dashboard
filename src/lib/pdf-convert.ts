const CLOUDCONVERT_API_URL = "https://api.cloudconvert.com/v2/jobs";

/**
 * Converts a .docx buffer to PDF via CloudConvert (import -> convert -> export/url,
 * chained as one job so CloudConvert handles the file transfer between tasks).
 * Requires CLOUDCONVERT_API_KEY to be set.
 */
export async function convertDocxToPdf(docxBuffer: Buffer, filename: string): Promise<Buffer> {
  const apiKey = process.env.CLOUDCONVERT_API_KEY;
  if (!apiKey) {
    throw new Error("CLOUDCONVERT_API_KEY is not configured.");
  }

  const authHeaders = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  // 1. Create a job with import/convert/export chained via task references.
  const jobRes = await fetch(CLOUDCONVERT_API_URL, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      tasks: {
        "import-file": { operation: "import/upload" },
        "convert-file": {
          operation: "convert",
          input: "import-file",
          output_format: "pdf",
          filename,
        },
        "export-file": {
          operation: "export/url",
          input: "convert-file",
        },
      },
    }),
  });

  if (!jobRes.ok) {
    throw new Error(`CloudConvert job creation failed: ${jobRes.status} ${await jobRes.text()}`);
  }

  const job = await jobRes.json();
  const importTask = job.data.tasks.find((t: { name: string }) => t.name === "import-file");
  const uploadForm = importTask.result.form;

  // 2. Upload the docx bytes to the presigned upload target CloudConvert gave us.
  const formData = new FormData();
  for (const [key, value] of Object.entries(uploadForm.parameters)) {
    formData.append(key, value as string);
  }
  formData.append("file", new Blob([new Uint8Array(docxBuffer)]), filename);

  const uploadRes = await fetch(uploadForm.url, { method: "POST", body: formData });
  if (!uploadRes.ok) {
    throw new Error(`CloudConvert upload failed: ${uploadRes.status} ${await uploadRes.text()}`);
  }

  // 3. Poll the job until the export task finishes, then download the PDF.
  const jobId = job.data.id;
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const statusRes = await fetch(`${CLOUDCONVERT_API_URL}/${jobId}`, {
      headers: authHeaders,
    });
    if (!statusRes.ok) {
      throw new Error(`CloudConvert status check failed: ${statusRes.status}`);
    }
    const statusJob = await statusRes.json();
    const exportTask = statusJob.data.tasks.find(
      (t: { name: string }) => t.name === "export-file"
    );

    if (exportTask?.status === "error") {
      throw new Error(`CloudConvert conversion failed: ${exportTask.message}`);
    }
    if (exportTask?.status === "finished") {
      const fileUrl = exportTask.result?.files?.[0]?.url;
      if (!fileUrl) throw new Error("CloudConvert export finished with no file URL.");
      const pdfRes = await fetch(fileUrl);
      if (!pdfRes.ok) throw new Error(`Failed to download converted PDF: ${pdfRes.status}`);
      return Buffer.from(await pdfRes.arrayBuffer());
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  throw new Error("CloudConvert conversion timed out.");
}
