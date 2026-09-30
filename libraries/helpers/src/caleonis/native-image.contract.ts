/** Public studio capabilities. Provider keys and endpoint URLs never belong here. */
export const nativeImageModels = ['gpt-image-2.5-sunburst', 'gpt-image-2.5-flare', 'gpt-image-2'] as const;
export const nativeQualities = ['low', 'medium', 'high'] as const;
export const nativeSizes: Record<string, Record<string, string>> = {
  '1k': { '1:1': '1024x1024', '9:16': '864x1536', '16:9': '1536x864', '4:3': '1344x1008', '3:4': '1008x1344', '3:2': '1536x1024', '2:3': '1024x1536', '21:9': '1792x768' },
  '2k': { '1:1': '2048x2048', '9:16': '1152x2048', '16:9': '2048x1152', '4:3': '2048x1536', '3:4': '1536x2048', '3:2': '2016x1344', '2:3': '1344x2016', '21:9': '2016x864' },
};
export const MAX_NATIVE_REFERENCES = 4;
export function nativeSize(ratio: string, resolution: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(nativeSizes, resolution)
    && Object.prototype.hasOwnProperty.call(nativeSizes[resolution], ratio)
    ? nativeSizes[resolution][ratio] : undefined;
}
export function creativeEngine(data: Record<string, any>): 'native' | 'higgsfield' {
  // Existing projects retain their provider; newly created projects use native.
  return data.engine === 'higgsfield' || (!data.engine && data.connectionId) ? 'higgsfield' : 'native';
}
