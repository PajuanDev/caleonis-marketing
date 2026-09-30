// Adapted from TechBeme/open-higgsfield src/models/capabilities/types.ts.
// Source blob 0d5a14bb35c2008fc2738dab6f32e223271bcd01. MIT, copyright 2026 TechBe.
// See THIRD_PARTY_NOTICES_CALÉONIS.md. Reduced to implemented controls; no safety override.
export interface FieldCapability<T = string> { options?: T[]; default?: T; }
export interface MediaSlotCapability {
  id: string; label: string; kind: 'image' | 'video' | 'audio'; required?: boolean;
  multiple?: boolean; accept?: string; type?: string; description?: string;
}
export interface ModelCapabilities {
  id: string; label: string; provider: string;
  prompt_required: boolean; prompt_max: number;
  duration: false | FieldCapability<string>;
  aspect_ratio: false | FieldCapability<[string, string]>;
  resolution_variant: false | FieldCapability<string>;
  media_slots: MediaSlotCapability[];
}
export const higgsfieldImage: ModelCapabilities = {
  id: 'marketing-studio/image', label: 'Marketing Studio Image', provider: 'higgsfield',
  prompt_required: true, prompt_max: 4000, duration: false,
  aspect_ratio: { options: [['Carré', '1:1'], ['Vertical', '9:16'], ['Paysage', '16:9'], ['4:3', '4:3'], ['3:4', '3:4'], ['3:2', '3:2'], ['2:3', '2:3'], ['21:9', '21:9']], default: ['Carré', '1:1'] },
  resolution_variant: { options: ['1k', '2k', '4k'], default: '1k' }, media_slots: [],
};
