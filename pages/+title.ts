export default function title(pageContext: { site?: { name?: string } }) {
  return pageContext.site?.name || "喵小铺";
}
