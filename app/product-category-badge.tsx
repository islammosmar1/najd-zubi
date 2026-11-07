import type { Lang, Settings } from '../lib/catalog';
import './product-category-badge.css';

export default function ProductCategoryBadge({category,settings,lang}:{category:string;settings:Settings;lang:Lang}) {
  const item=settings.categories.find(c=>c[0]===category&&c[0]!=='all');
  const label=item?.[lang==='ar'?1:lang==='en'?2:3]||item?.[1];
  if(!label) return null;
  return <span className="product-category-badge" dir="auto">{label}</span>;
}
