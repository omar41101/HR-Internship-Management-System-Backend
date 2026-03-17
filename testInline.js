import fetch from 'node-fetch';

async function test() {
  const url = 'https://res.cloudinary.com/duzfqgwe4/raw/upload/v1773699383/hrcom/personal_docs/docs/table%20existing.pdf';
  const res = await fetch(url);
  console.log("Status:", res.status);
  console.log("Content-Type:", res.headers.get("content-type"));
  console.log("Content-Disposition:", res.headers.get("content-disposition"));
  if (res.status >= 400) {
    console.log("Body:", await res.text());
  }
}
test();
