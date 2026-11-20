import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { SeoService } from './seo.service';

/**
 * Server-rendered pages for search engines: /services, /services/:category,
 * /services/:category/:city, plus /sitemap.xml and /robots.txt.
 * Mounted at the site root (excluded from the /api/v1 prefix in main.ts).
 */
@ApiExcludeController()
@Controller()
export class SeoController {
  constructor(private readonly seo: SeoService) {}

  private baseUrl(req: Request): string {
    const configured = process.env.PUBLIC_BASE_URL;
    if (configured) return configured.replace(/\/+$/, '');
    return req.protocol + '://' + req.get('host');
  }

  private html(res: Response, body: string) {
    res.set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600' });
    res.send(body);
  }

  @Get('services')
  async index(@Req() req: Request, @Res() res: Response) {
    this.html(res, await this.seo.renderIndex(this.baseUrl(req)));
  }

  @Get('services/:category')
  async category(@Param('category') category: string, @Req() req: Request, @Res() res: Response) {
    this.html(res, await this.seo.renderCategory(this.baseUrl(req), category.toLowerCase()));
  }

  @Get('services/:category/:city')
  async listing(
    @Param('category') category: string,
    @Param('city') city: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const base = this.baseUrl(req);
    const data = await this.seo.getListing(category.toLowerCase(), city.toLowerCase());
    this.html(res, this.seo.renderListing(base, data));
  }

  @Get('sitemap.xml')
  async sitemap(@Req() req: Request, @Res() res: Response) {
    res.set({ 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
    res.send(await this.seo.renderSitemap(this.baseUrl(req)));
  }

  @Get('robots.txt')
  robots(@Req() req: Request, @Res() res: Response) {
    res.type('text/plain').send(
      'User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /app\nDisallow: /api\n\nSitemap: ' +
        this.baseUrl(req) + '/sitemap.xml\n',
    );
  }
}
