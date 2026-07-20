import { z } from 'zod';
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { DataForSEOClient } from '../client/dataforseo.client.js';
import { defaultGlobalToolConfig } from '../config/global.tool.js';
import { shouldParseAsFullResponse } from '../config/request-mode.js';
import { DEFAULT_DATAFORSEO_TOOL_ANNOTATIONS } from '../config/tool-annotations.js';
import { filterFields, parseFieldPaths } from '../utils/field-filter.js';
import { FieldConfigurationManager } from '../config/field-configuration.js';
import {
  serializeToolResponsePayload,
  wrapPayloadWithUsage,
  type DataForSEOUsageMetadata,
  type DataForSEOUsageWrappedResponse,
} from '../response/tool-response.js';

export type {
  DataForSEOUsageMetadata,
  DataForSEOUsageWrappedResponse,
} from '../response/tool-response.js';

export interface DataForSEOFullResponse {
  version: string;
  status_code: number;
  status_message: string;
  time: string;
  cost: number;
  tasks_count: number;
  tasks_error: number;
  tasks: Array<{
    id: string;
    status_code: number;
    status_message: string;
    time: string;
    cost: number;
    result_count: number;
    path: string[];
    data: Record<string, any>;
    result: any[];
  }>;
}

export interface DataForSEOResponse {
  id: string;
  status_code: number;
  status_message: string;
  items: any[];
}

export abstract class BaseTool {
  protected dataForSEOClient: DataForSEOClient;

  constructor(dataForSEOClient: DataForSEOClient) {
    this.dataForSEOClient = dataForSEOClient;
  }

  protected supportOnlyFullResponse(): boolean {
    return false;
  }

  protected formatError(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error';
  }

  protected getFilterExpression(): z.ZodType<any> {
    if( defaultGlobalToolConfig.simpleFilter ) {
      // Permissive filter schema for LLM tool compatibility (e.g., OpenAI/ChatGPT).
      // If you modify this behavior, re-verify compatibility with OpenAI tools.
      return z.array(z.any());
    }
    const filterExpression = 
    z.array(
        z.union([
          z.array(z.union([z.string(), z.number(), z.boolean()])).length(3),
          z.enum(["and", "or"]),
          z.array(z.unknown()).length(3),
          z.union([z.string(), z.number(),z.unknown()]),
          z.any()  
        ])
      ).max(3);
    return filterExpression;
  }

  protected shouldParseAsFullResponse(): boolean {
    return shouldParseAsFullResponse(defaultGlobalToolConfig);
  }

  protected extractToolPayload(
    response: DataForSEOFullResponse | DataForSEOResponse,
    mode: 'ai' | 'full',
  ): unknown {
    if (mode === 'full') {
      return (response as DataForSEOFullResponse).tasks[0].result;
    }

    return response;
  }

  protected applyConfiguredFieldFilter(payload: unknown, fullData: boolean = false): unknown {
    const fieldConfig = FieldConfigurationManager.getInstance();
    if (!fieldConfig.hasConfiguration() || fullData) {
      return payload;
    }

    const toolName = this.getName();
    if (!fieldConfig.isToolConfigured(toolName)) {
      return payload;
    }

    const fields = fieldConfig.getFieldsForTool(toolName);
    if (!fields || fields.length === 0) {
      return payload;
    }

    return filterFields(payload, parseFieldPaths(fields));
  }

  protected formatToolOutput(
    payload: unknown,
    options?: { billingResponse?: DataForSEOFullResponse; fullData?: boolean },
  ): { content: Array<{ type: string; text: string }> } {
    const filteredPayload = this.applyConfiguredFieldFilter(
      payload,
      options?.fullData ?? false,
    );
    const output = wrapPayloadWithUsage(
      filteredPayload,
      options?.billingResponse,
      defaultGlobalToolConfig.includeUsage,
    );

    return {
      content: [
        {
          type: 'text',
          text: serializeToolResponsePayload(output),
        },
      ],
    };
  }

  protected validateAndFormatResponse(
    response: any,
    fullData: boolean = false,
  ): { content: Array<{ type: string; text: string }> } {
    if (defaultGlobalToolConfig.debug) {
      console.error(JSON.stringify(response));
    }

    if (this.shouldParseAsFullResponse()) {
      const data = response as DataForSEOFullResponse;
      this.validateResponseFull(data);
      const payload = this.extractToolPayload(data, 'full');

      return this.formatToolOutput(payload, {
        billingResponse: defaultGlobalToolConfig.includeUsage ? data : undefined,
        fullData,
      });
    }

    this.validateResponse(response);
    const payload = this.extractToolPayload(response, 'ai');
    return this.formatToolOutput(payload, { fullData });
  }

  protected formatResponse(
    data: any,
    fullData: boolean = false,
  ): { content: Array<{ type: string; text: string }> } {
    return this.formatToolOutput(data, { fullData });
  }

  protected formatErrorResponse(error: unknown): { content: Array<{ type: string; text: string }> } {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${this.formatError(error)}`,
        },
      ],
    };
  }

  protected validateResponse(response: DataForSEOResponse): void {
    if (Math.floor(response.status_code / 100) !== 200) {
      throw new Error(`API Error: ${response.status_message} (Code: ${response.status_code})`);
    }
  }

  protected validateResponseFull(response: DataForSEOFullResponse): void {
    if (Math.floor(response.status_code / 100) !== 200) {
      throw new Error(`API Error: ${response.status_message} (Code: ${response.status_code})`);
    }

    if (response.tasks.length === 0) {
      throw new Error('No tasks in response');
    }

    const task = response.tasks[0];
    if (Math.floor(task.status_code / 100) !== 200) {
      throw new Error(`Task Error: ${task.status_message} (Code: ${task.status_code})`);
    }

    if (response.tasks_error > 0) {
      throw new Error(`Tasks Error: ${response.tasks_error} tasks failed`);
    }
  }

  abstract getName(): string;
  abstract getTitle(): string;
  abstract getDescription(): string;
  abstract getParams(): z.ZodRawShape;
  abstract handle(params: any): Promise<any>;

  getAnnotations(): ToolAnnotations {
    return DEFAULT_DATAFORSEO_TOOL_ANNOTATIONS;
  }

  protected filterResponseFields(response: any, fields: string[]): any {
    if (!fields || fields.length === 0) {
      return response;
    }

    const fieldPaths = parseFieldPaths(fields);
    return filterFields(response, fieldPaths);
  }

  protected formatFilters(filters: any[]): any {
    if (!filters)
      return null;
    if (filters.length === 0) {
      return null;
    }
    return this.removeNested(filters);
  }

  private removeNested(filters: any[]): any[] {
    for (var i = 0; i < filters.length; i++) {
      if (Array.isArray(filters[i]) && filters[i].length == 1 && Array.isArray(filters[i][0])) {
        filters[i] = this.removeNested(filters[i][0]);
      }
    }
    return filters;
  }

  protected formatOrderBy(orderBy: any[]): any {
    if (!orderBy)
      return null;
    if (orderBy.length === 0) {
      return null;
    }
    return orderBy;
  }
}
