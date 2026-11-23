import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F6F8FB] dark:bg-[#090E1A] px-6 py-12">
      <div className="max-w-md w-full rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
          404
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-50">
          Không tìm thấy trang
        </h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          Đường dẫn bạn truy cập không tồn tại hoặc đã được thay đổi.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 transition-colors"
        >
          Về trang chủ TM-Lingo
        </Link>
      </div>
    </main>
  );
}
