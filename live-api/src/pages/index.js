import Head from "next/head";
import Link from "next/link";
import Script from "next/script";
import WebConsole from "components/WebConsole";

export default function Index() {
  const element = (
    <>
      <Head>
        <title>Gemini Live-API Console</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Script src="https://cdn.tailwindcss.com" />
      <WebConsole />
    </>
  );

  return element;
}
