import { isAllowedUpload } from './upload-policy';

describe('upload policy', () => {
  it.each([
    ['document.pdf', 'application/pdf'],
    ['photo.PNG', 'image/png'],
    ['sheet.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
  ])('accepts an allowed extension and matching MIME type', (name, mime) => {
    expect(isAllowedUpload(name, mime)).toBe(true);
  });

  it.each([
    ['attack.html', 'text/html'],
    ['attack.svg', 'image/svg+xml'],
    ['attack.exe', 'application/octet-stream'],
    ['fake.png', 'text/html']
  ])('rejects active or mismatched content', (name, mime) => {
    expect(isAllowedUpload(name, mime)).toBe(false);
  });
});
