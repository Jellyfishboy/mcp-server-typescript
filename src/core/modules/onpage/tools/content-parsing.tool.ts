import { z } from 'zod';
import { BaseTool, DataForSEOFullResponse, DataForSEOResponse } from '../../base.tool.js';
import { DataForSEOClient } from '../../../client/dataforseo.client.js';

export class ContentParsingTool extends BaseTool {
  constructor(dataForSEOClient: DataForSEOClient) {
    super(dataForSEOClient);
  }

  getName(): string {
    return 'on_page_content_parsing';
  }

  getDescription(): string {
    return 'This endpoint allows parsing the content on any page you specify and will return the structured content of the target page, including link URLs, anchors, headings, and textual content.';
  }

  getTitle(): string {
    return 'On Page Content Parsing';
  }

  getParams(): z.ZodRawShape {
    return {
      url: z.string().describe("URL of the page to parse"),
      enable_javascript: z.boolean().optional().describe("Enable JavaScript rendering"),
      custom_user_agent: z.string().optional().describe("Custom User-Agent header"),
      accept_language: z.string().optional().describe("Accept-Language header value"),
    };
  }

  protected extractToolPayload(
    response: DataForSEOFullResponse | DataForSEOResponse,
    mode: 'ai' | 'full',
  ): unknown {
    if (mode === 'ai') {
      return (response as DataForSEOResponse).items[0].page_as_markdown;
    }

    const result = (response as DataForSEOFullResponse).tasks[0].result;
    return this.extractMarkdownFromFullResult(result);
  }

  private extractMarkdownFromFullResult(result: unknown): string {
    if (typeof result === 'string') {
      return result;
    }

    if (Array.isArray(result)) {
      for (const item of result) {
        const markdown = this.extractMarkdownFromResultItem(item);
        if (markdown) {
          return markdown;
        }
      }
    }

    const markdown = this.extractMarkdownFromResultItem(result);
    if (markdown) {
      return markdown;
    }

    throw new Error('No page_as_markdown found in content parsing response');
  }

  private extractMarkdownFromResultItem(item: unknown): string | undefined {
    if (!item || typeof item !== 'object') {
      return undefined;
    }

    const record = item as Record<string, unknown>;
    const nestedItems = record.items;
    if (Array.isArray(nestedItems) && nestedItems[0] && typeof nestedItems[0] === 'object') {
      const nested = nestedItems[0] as Record<string, unknown>;
      if (typeof nested.page_as_markdown === 'string') {
        return nested.page_as_markdown;
      }
    }

    if (typeof record.page_as_markdown === 'string') {
      return record.page_as_markdown;
    }

    return undefined;
  }

  async handle(params: { 
    url: string; 
    enable_javascript?: boolean; 
    custom_user_agent?: string; 
    accept_language?: string; 
  }): Promise<any> {
    try {
      const response = await this.dataForSEOClient.makeRequest('/v3/on_page/content_parsing/live', 'POST', [{
        url: params.url,
        enable_javascript: params.enable_javascript,
        custom_user_agent: params.custom_user_agent,
        accept_language: params.accept_language,
        markdown_view: true
      }]);

      if (this.shouldParseAsFullResponse()) {
        const data = response as DataForSEOFullResponse;
        this.validateResponseFull(data);
        const payload = this.extractToolPayload(data, 'full');

        return this.formatToolOutput(payload, {
          billingResponse: data,
        });
      }

      const data = response as DataForSEOResponse;
      this.validateResponse(data);
      const payload = this.extractToolPayload(data, 'ai');
      return this.formatToolOutput(payload);
    } catch (error) {
      return this.formatErrorResponse(error);
    }
  }
}
