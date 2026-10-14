export default function title(pageContext: { data?: { name?: string }; site?: { name?: string } }) {
  const siteName = pageContext.site?.name || "喵小铺";
  return pageContext.data?.name ? `${pageContext.data.name} - ${siteName}` : siteName;
}
