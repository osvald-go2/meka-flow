// In-memory store for non-Electron fallback
const memoryStore = new Map<string, string>();

function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.aiBackend?.harness;
}

export function sanitizeGroupId(groupId: string): string {
  return groupId.replace(/[^a-zA-Z0-9-]/g, '');
}

const ALLOWED_FILENAMES = /^(plan|result(-\d+)?|review-\d+)\.md$/;

export function validateFilename(filename: string): string {
  if (!ALLOWED_FILENAMES.test(filename)) {
    throw new Error(`Invalid harness filename: ${filename}`);
  }
  return filename;
}

export function getHarnessDir(projectDir: string, groupId: string): string {
  return `${projectDir}/.harness/${sanitizeGroupId(groupId)}`;
}

export function getSprintDir(projectDir: string, groupId: string, sprint: number): string {
  return `${getHarnessDir(projectDir, groupId)}/sprint-${sprint}`;
}

export async function writeHarnessFile(
  projectDir: string,
  groupId: string,
  sprint: number,
  filename: string,
  content: string
): Promise<string> {
  const safeFilename = validateFilename(filename);
  const dir = getSprintDir(projectDir, groupId, sprint);
  const filePath = `${dir}/${safeFilename}`;

  if (isElectron()) {
    await window.aiBackend.harness.mkdir(dir);
    await window.aiBackend.harness.writeFile(filePath, content);
  } else {
    memoryStore.set(filePath, content);
    console.log(`[harness-mock] wrote ${filePath} (${content.length} bytes)`);
  }

  return filePath;
}

export async function readHarnessFile(
  projectDir: string,
  groupId: string,
  sprint: number,
  filename: string
): Promise<string> {
  const safeFilename = validateFilename(filename);
  const filePath = `${getSprintDir(projectDir, groupId, sprint)}/${safeFilename}`;

  if (isElectron()) {
    return await window.aiBackend.harness.readFile(filePath);
  } else {
    const content = memoryStore.get(filePath);
    if (content === undefined) {
      throw new Error(`[harness-mock] file not found: ${filePath}`);
    }
    return content;
  }
}
