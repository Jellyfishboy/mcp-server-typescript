import type { GlobalToolConfig } from '../config/global.tool.js';

export type MakeRequestOptions = {
  forceFull?: boolean;
  forceAi?: boolean;
};

export function shouldUseFullApiEndpoint(
  config: Pick<GlobalToolConfig, 'fullResponse' | 'includeUsage'>,
  options?: MakeRequestOptions | boolean,
): boolean {
  const normalized = normalizeMakeRequestOptions(options);

  if (normalized.forceAi) {
    return false;
  }

  return Boolean(
    normalized.forceFull || config.fullResponse || config.includeUsage,
  );
}

export function shouldParseAsFullResponse(
  config: Pick<GlobalToolConfig, 'fullResponse' | 'includeUsage'>,
): boolean {
  return config.fullResponse || config.includeUsage;
}

export function normalizeMakeRequestOptions(
  options?: MakeRequestOptions | boolean,
): MakeRequestOptions {
  if (typeof options === 'boolean') {
    return { forceFull: options };
  }

  return options ?? {};
}
