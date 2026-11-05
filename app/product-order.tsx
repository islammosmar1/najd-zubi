'use client';

import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { useState } from 'react';
import type { Lang, Product, Settings } from '../lib/catalog';
import { asError } from '../lib/errors';
import { db } from '../lib/supabase';
import { sortProducts } from '../lib/taxonomy';

export default function ProductOrder({
  products,
  settings,
  lang,
  onSaved,
  toast,
}: {
  products: Product[];
  settings: Settings;
  lang: Lang;
  onSaved: React.Dispatch<React.SetStateAction<Product[]>>;
  toast: (s: string) => void;
}) {
  const t = (ar: string, en: string, he: string) => (lang === 'ar' ? ar : lang === 'en' ? en : he);
  const [category, setCategory] = useState('');
  const [draftIds, setIds] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [assignCategory, setAssignCategory] = useState('');

  const categories = settings.categories.filter((item) => item[0] !== 'all');
  const ids = dirty
    ? draftIds
    : sortProducts(products.filter((product) => product.category === category)).map((product) => product.id);
  const selectableProducts = sortProducts(products);
  const allSelected = selectableProducts.length > 0 && selectedIds.length === selectableProducts.length;

  const reset = () => setDirty(false);

  function move(from: number, to: number) {
    if (busy || from < 0 || to < 0 || to >= ids.length) return;
    const next = [...ids];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setIds(next);
    setDirty(true);
  }

  async function save() {
    if (!db) return toast(t('اتصال قاعدة البيانات مطلوب', 'Database connection required', 'נדרש חיבור למסד נתונים'));
    setBusy(true);
    try {
      const { error } = await db.rpc('reorder_category_products', { category_id: category, ordered_ids: ids });
      if (error) throw error;
      onSaved((current) =>
        current.map((product) =>
          product.category === category && ids.includes(product.id)
            ? { ...product, sortOrder: ids.indexOf(product.id) + 1 }
            : product,
        ),
      );
      setDirty(false);
      toast(t('حُفظ ترتيب القسم ويظهر للزبائن', 'Category order saved for shoppers', 'סדר הקטגוריה נשמר ללקוחות'));
    } catch (caught: unknown) {
      toast(asError(caught).message);
    } finally {
      setBusy(false);
    }
  }

  async function assignProductsToCategory() {
    if (!db) return toast(t('اتصال قاعدة البيانات مطلوب', 'Database connection required', 'נדרש חיבור למסד נתונים'));
    if (!assignCategory || !selectedIds.length) return;

    setBusy(true);
    try {
      const { error } = await db.from('products').update({ category: assignCategory }).in('id', selectedIds);
      if (error) throw error;
      onSaved((current) =>
        current.map((product) => (selectedIds.includes(product.id) ? { ...product, category: assignCategory } : product)),
      );
      setSelectedIds([]);
      toast(t('تم تعيين المنتجات للقسم المختار', 'Products were assigned to the selected category', 'המוצרים שויכו לקטגוריה שנבחרה'));
    } catch (caught: unknown) {
      toast(asError(caught).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <details className="studio-disclosure product-order">
        <summary>{t('ترتيب المنتجات داخل الأقسام', 'Arrange products by category', 'סידור מוצרים לפי קטגוריה')}</summary>
        <p>{t('اختاري القسم، اسحبي المنتجات أو استخدمي الأسهم ثم احفظي. القسم الرئيسي يعرض منتجات أقسامه الفرعية أيضًا؛ هنا ترتبين المنتجات المعيّنة للقسم المختار مباشرة.', 'Choose a category, drag products or use the arrows, then save. This list contains products assigned directly to this category.', 'בחרו קטגוריה, גררו מוצרים או השתמשו בחצים ושמרו. הרשימה מציגה מוצרים המשויכים ישירות לקטגוריה.')}</p>
        <div className="toolbar">
          <select
            aria-label={t('القسم', 'Category', 'קטגוריה')}
            value={category}
            disabled={busy}
            onChange={(event) => {
              if (!dirty || confirm(t('ترك الترتيب دون حفظ؟', 'Discard unsaved order?', 'לבטל סדר שלא נשמר?'))) {
                setCategory(event.target.value);
                setDirty(false);
              }
            }}
          >
            <option value="">{t('اختاري القسم', 'Choose category', 'בחרו קטגוריה')}</option>
            {categories.map((item) => (
              <option key={item[0]} value={item[0]}>
                {item[lang === 'ar' ? 1 : lang === 'en' ? 2 : 3] || item[1]}
              </option>
            ))}
          </select>
          <button type="button" className="btn primary" disabled={!dirty || busy} onClick={save}>
            {busy ? t('جارٍ الحفظ…', 'Saving…', 'שומר…') : t('حفظ الترتيب', 'Save order', 'שמירת סדר')}
          </button>
          <button type="button" className="btn outline" disabled={!dirty || busy} onClick={reset}>
            {t('تراجع', 'Reset', 'איפוס')}
          </button>
          <span role="status">{dirty ? t('تغييرات غير محفوظة', 'Unsaved changes', 'שינויים שלא נשמרו') : ''}</span>
        </div>
        <ol className="product-order-list">
          {ids.map((id, index) => {
            const product = products.find((item) => item.id === id);
            return product ? (
              <li
                key={id}
                draggable={!busy}
                onDragStart={() => setDrag(id)}
                onDragEnd={() => setDrag(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  if (drag) move(ids.indexOf(drag), index);
                  setDrag(null);
                }}
              >
                <GripVertical size={16} />
                <span>{index + 1}</span>
                <img src={product.images[0]} alt="" loading="lazy" />
                <div>
                  <strong>{product.name[lang] || product.name.ar}</strong>
                  <small>{product.status} · {product.price} ₪</small>
                </div>
                <button type="button" disabled={busy || index === 0} aria-label={t('للأعلى', 'Move up', 'למעלה')} onClick={() => move(index, index - 1)}>
                  <ArrowUp size={18} />
                </button>
                <button type="button" disabled={busy || index === ids.length - 1} aria-label={t('للأسفل', 'Move down', 'למטה')} onClick={() => move(index, index + 1)}>
                  <ArrowDown size={18} />
                </button>
              </li>
            ) : null;
          })}
        </ol>
        {category && !ids.length && <p>{t('لا توجد منتجات في هذا القسم', 'No products in this category', 'אין מוצרים בקטגוריה זו')}</p>}
      </details>

      <details className="studio-disclosure product-order" open>
        <summary>{t('تعيين قسم لعدة منتجات', 'Assign a category to multiple products', 'שיוך קטגוריה למספר מוצרים')}</summary>
        <p>{t('حددي المنتجات، اختاري القسم، ثم اضغطي تعيين القسم. هذا يغيّر القسم فقط ولا يغيّر السعر أو الكمية أو الصور.', 'Select products, choose a category, then assign it. This only changes the category, not prices, stock, or images.', 'בחרו מוצרים, בחרו קטגוריה ולחצו שיוך קטגוריה. הפעולה משנה רק את הקטגוריה, ולא מחיר, מלאי או תמונות.')}</p>
        <div className="toolbar">
          <label>
            <input
              type="checkbox"
              checked={allSelected}
              disabled={busy || !selectableProducts.length}
              onChange={(event) => setSelectedIds(event.target.checked ? selectableProducts.map((product) => product.id) : [])}
            />
            {' '}{t('تحديد الكل', 'Select all', 'בחירת הכל')}
          </label>
          <select
            aria-label={t('القسم الجديد', 'New category', 'קטגוריה חדשה')}
            value={assignCategory}
            disabled={busy}
            onChange={(event) => setAssignCategory(event.target.value)}
          >
            <option value="">{t('اختاري القسم', 'Choose category', 'בחרו קטגוריה')}</option>
            {categories.map((item) => (
              <option key={item[0]} value={item[0]}>
                {item[lang === 'ar' ? 1 : lang === 'en' ? 2 : 3] || item[1]}
              </option>
            ))}
          </select>
          <button type="button" className="btn primary" disabled={busy || !assignCategory || !selectedIds.length} onClick={assignProductsToCategory}>
            {busy
              ? t('جارٍ التعيين…', 'Assigning…', 'משייך…')
              : t(`تعيين القسم (${selectedIds.length})`, `Assign category (${selectedIds.length})`, `שיוך קטגוריה (${selectedIds.length})`)}
          </button>
        </div>
        <ol className="product-order-list">
          {selectableProducts.map((product) => (
            <li key={product.id}>
              <input
                type="checkbox"
                aria-label={product.name[lang] || product.name.ar}
                checked={selectedIds.includes(product.id)}
                disabled={busy}
                onChange={(event) =>
                  setSelectedIds((current) =>
                    event.target.checked ? [...current, product.id] : current.filter((id) => id !== product.id),
                  )
                }
              />
              <img src={product.images[0]} alt="" loading="lazy" />
              <div>
                <strong>{product.name[lang] || product.name.ar}</strong>
                <small>{product.status} · {product.price} ₪</small>
              </div>
            </li>
          ))}
        </ol>
      </details>
    </>
  );
}