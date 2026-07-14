export interface DerivedArtifactVerification { valid: boolean; errors: string[] }
export function verifyDerivedArtifactSet(outputDirectory: string): Promise<DerivedArtifactVerification>
