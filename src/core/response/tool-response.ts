import type { GlobalToolConfig } from '../config/global.tool.js';

export interface DataForSEOUsageMetadata {
  cost_usd: number;
  task_cost_usd: number;
  tasks_count: number;
  tasks_error: number;
}

export interface DataForSEOUsageWrappedResponse<T = unknown> {
  data: T;
  usage: DataForSEOUsageMetadata;
}

export interface DataForSEOFullResponseForUsage {
  cost: number;
  tasks_count: number;
  tasks_error: number;
  tasks: Array<{
    cost: number;
  }>;
}

export function buildUsageMetadata(
  response: DataForSEOFullResponseForUsage,
): DataForSEOUsageMetadata {
  const task = response.tasks[0];

  return {
    cost_usd: response.cost,
    task_cost_usd: task?.cost ?? response.cost,
    tasks_count: response.tasks_count,
    tasks_error: response.tasks_error,
  };
}

export function isUsageWrappedPayload(
  value: unknown,
): value is DataForSEOUsageWrappedResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as DataForSEOUsageWrappedResponse;
  return 'data' in candidate && 'usage' in candidate;
}

export function wrapPayloadWithUsage<T>(
  payload: T,
  response: DataForSEOFullResponseForUsage | undefined,
  includeUsage: boolean,
): T | DataForSEOUsageWrappedResponse<T> {
  if (!includeUsage) {
    return payload;
  }

  if (!response) {
    throw new Error('Usage metadata requires a full DataForSEO API response');
  }

  return {
    data: payload,
    usage: buildUsageMetadata(response),
  };
}

export function shouldIncludeUsageMetadata(
  config: Pick<GlobalToolConfig, 'includeUsage'>,
): boolean {
  return config.includeUsage;
}

export function serializeToolResponsePayload(payload: unknown): string {
  return JSON.stringify(payload, null, 2);
}
