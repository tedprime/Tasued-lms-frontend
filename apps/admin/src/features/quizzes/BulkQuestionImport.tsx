import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, apiBaseUrl, errorMessage, type QuestionImportPreview } from "@tasued/api-client";
import { Alert, Button, Field, Input, Modal, useToast } from "@tasued/ui";

export function BulkQuestionImport({bankId, courseId, onClose}:{bankId:string; courseId:string; onClose:()=>void}) {
  const [file,setFile]=useState<File>();
  const [preview,setPreview]=useState<QuestionImportPreview>();
  const qc=useQueryClient(); const toast=useToast();
  const upload=useMutation({
    mutationFn:(commit:boolean)=>api.quizzes.importQuestions(bankId,file!,commit),
    onSuccess:async(result,commit)=>{
      if(!commit) {setPreview(result);return;}
      await Promise.all([qc.invalidateQueries({queryKey:["quizzes","questions",bankId]}),qc.invalidateQueries({queryKey:["quizzes","banks",courseId]})]);
      toast.success(`${result.importedCount} question${result.importedCount===1?'':'s'} imported`,`${result.duplicateCount} duplicate${result.duplicateCount===1?'':'s'} skipped.`);
      onClose();
    },
  });
  return <Modal open size="lg" title="Bulk upload questions" onClose={()=>{if(!upload.isPending)onClose();}} footer={<>
    <Button variant="outline" disabled={upload.isPending} onClick={onClose}>Cancel</Button>
    {!preview ? <Button disabled={!file} loading={upload.isPending} onClick={()=>upload.mutate(false)}>Preview questions</Button>
      : <Button disabled={preview.errorCount>0 || preview.readyCount===0} loading={upload.isPending} onClick={()=>upload.mutate(true)}>Import {preview.readyCount} questions</Button>}
  </>}>
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">Upload up to 500 questions in a CSV or XLSX file (maximum 2 MB). Download a template, replace its sample questions, then preview your file.</p>
      <div className="flex flex-wrap gap-4 text-sm font-semibold text-primary-500">
        <a href={api.quizzes.questionTemplateUrl(apiBaseUrl(),bankId,'csv')} download>Download CSV template</a>
        <a href={api.quizzes.questionTemplateUrl(apiBaseUrl(),bankId,'xlsx')} download>Download XLSX template</a>
      </div>
      <details className="rounded-lg border border-neutral-200 p-3 text-sm">
        <summary className="cursor-pointer font-semibold">Column and answer guide</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Use type: single_choice, multiple_choice, true_false, short_answer or essay.</li>
          <li>Write the question as plain text. Options go in option_a through option_f.</li>
          <li>For choices, correct_answers contains a letter (B) or letters separated by | (A|C). For true/false use true or false.</li>
          <li>For short answers, list accepted_answers separated by |. Essay questions are marked manually.</li>
          <li>Points defaults to 1. Explanation and tags are optional; separate tags with |.</li>
          <li>Use one worksheet, plain text and numbers. Do not use formulas or merged cells.</li>
        </ul>
      </details>
      <Field label="Question file" htmlFor="question-import-file">
        <Input id="question-import-file" type="file" accept=".csv,.xlsx" disabled={upload.isPending} onChange={e=>{setFile(e.target.files?.[0]);setPreview(undefined);upload.reset();}} />
      </Field>
      {upload.isError && <Alert tone="red">{errorMessage(upload.error)}</Alert>}
      {preview && <>
        <Alert tone={preview.errorCount?'red':'blue'}>{preview.readyCount} ready · {preview.duplicateCount} duplicates skipped · {preview.errorCount} errors. {preview.errorCount>0?'Correct the errors and select the revised file. Nothing has been saved.':'Review the rows below, then import. Existing questions will not be overwritten.'}</Alert>
        <div className="max-h-80 overflow-auto rounded-lg border border-neutral-200">
          <table className="w-full text-left text-sm"><thead className="sticky top-0 bg-neutral-100"><tr><th className="p-2">Row</th><th className="p-2">Question</th><th className="p-2">Result</th></tr></thead><tbody>
            {preview.rows.map(row=><tr key={row.row} className="border-t border-neutral-200"><td className="p-2 align-top">{row.row}</td><td className="max-w-sm break-words p-2">{row.prompt}<span className="block text-xs text-neutral-500">{row.type}</span></td><td className="p-2">{row.status==='error'?row.errors.join(' '):row.status==='duplicate'?'Duplicate — skipped':'Ready'}</td></tr>)}
          </tbody></table>
        </div>
      </>}
    </div>
  </Modal>;
}
