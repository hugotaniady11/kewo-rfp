import CloudConvert from "cloudconvert";

const apiKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxIiwianRpIjoiNDNjYzMxNjEwNjA4NDZlN2M4ZWQxMzc0MDliYzMwZWQyZmJhODY3YWVjODNhNTI2ODk5MDJlODJiZDllMGJlZDEwM2RiMTQ5Y2JmNzc5ZmEiLCJpYXQiOjE3NjEwOTQwMjQuNzkzODE5LCJuYmYiOjE3NjEwOTQwMjQuNzkzODIsImV4cCI6NDkxNjc2NzYyNC43ODkyOTEsInN1YiI6IjcyNzkzNDc3Iiwic2NvcGVzIjpbInRhc2sucmVhZCIsInRhc2sud3JpdGUiLCJ3ZWJob29rLnJlYWQiXX0.bnwuHwUy-Dyd_cQtR9NaOIxBY3j-fDM9YlR7xGPaUhgu3qv2bv3m0cNp49V7nagiaUxxue5Um90cW8e9YGdTc31o_fIRQA2TG1DQmQyvaUGsU8OaC4835xqYKJO8VZ_6PWtZgDX90omv5O6syBzj4fZzqkoFqAShs4IKj0hZLVYYRAQq3GGXqU3GjlBEMcPBPc4ngQAzqkhAtFCXBD-SkveqbLjaXTnoJCAMSEmkmdZUHMmm4JsmyCuUO-R5VI3eCgTCBeeTAhgTKcdf7p6OuUsdMAnO2eEqL_piLFNop3OKFGuRbpoOIakqnldKU_aQiL0Ne29bFw77rFGnpEWqdEsVa2c28SgqvAkDp2q7_rmwTSt8HqhO7dROn31xW2RTw5v_nFRh__SSJUqxH9Cz5iIrtyHB-Kck8V8PFenOF7afcYLTuGeO4BKbCt5nF_IfvwiQS7F5MjQ9mCaom4UgX4YaEjl2lgQ1heWpR1vi2Xk61Fk4KBDw3R2L-Mcw4s7fx30bQRRvGqM32GFCmGFzTNBsqCpGC8__WDa1aulKPrb3gnYQUwIXoO5_eNQTrJ4jmR8NHnsRgtrBV4YCCY5_MKqvHjJ8vtnpul5f4cJVqvqntOCujkM_0O7hMoxPfPlmbFIiPLq-GV219KnbwNhZxXEX9_IvANLSuj8W7Pzqh_k';
const cloudConvert = new CloudConvert(apiKey);

export const convertToPdf = async (file: File) => {
  const job = await cloudConvert.jobs.create({
    tasks: {
      importFile: { operation: "import/upload" },
      convertFile: {
        operation: "convert",
        input: "importFile",
        output_format: "pdf",
      },
      exportResult: { operation: "export/url", input: "convertFile" },
    },
  });

  const uploadTask = job.tasks?.find((t: any) => t.name === "importFile");
  if (!uploadTask?.result?.form?.url) throw new Error("Upload form missing.");

  const formData = new FormData();
  for (const [key, val] of Object.entries(
    uploadTask.result.form.parameters || {}
  )) {
    formData.append(key, val as string);
  }
  formData.append("file", file);

  await fetch(uploadTask.result.form.url, { method: "POST", body: formData });

  const completed = await cloudConvert.jobs.wait(job.id);
  const exportTask = completed.tasks?.find((t: any) => t.name === "exportResult");
  const url = exportTask?.result?.files?.[0]?.url;
  if (!url) throw new Error("Conversion output missing.");
  return url; // ✅ downloadable PDF URL
};