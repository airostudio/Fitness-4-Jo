import Link from "next/link";
export default function NotFound() {
  return <div className="space-y-4 py-10 text-center"><h1 className="text-3xl font-bold">We couldn&apos;t find that page</h1><Link href="/" className="inline-flex min-h-12 items-center font-semibold underline">Back home</Link></div>;
}
