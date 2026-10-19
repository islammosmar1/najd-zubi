'use client';
import Link from 'next/link';
export default function StoreError({reset}:{reset:()=>void}){return <main className="container section" dir="rtl"><h1>تعذر تحميل الصفحة</h1><p role="alert">تحققي من الاتصال وحاولي مجددًا. Please retry · נסו שוב</p><button className="btn primary" onClick={reset}>إعادة المحاولة · Retry</button><Link className="btn outline" href="/">الرئيسية · Home</Link></main>}
