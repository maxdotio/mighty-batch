//sitemap.js
import fs from 'fs';
import { Sitemapper } from 'sitemapper';
const sitemap = new Sitemapper();

exports async function get_sites(sitemap) {
  sitemap = sitemap || 'https://max.io/sitemap.xml';
  const sites = await sitemap.fetch(SITEMAP);
  return sites;
}