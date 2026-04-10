/**
 * Image Input — cross-platform clipboard image reading + file path support
 * 
 * Supports:
 * - /image <path> — attach a local image file
 * - /image clipboard — grab image from clipboard (Windows/macOS/Linux)
 * - Drag & drop file paths (auto-detected)
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { extname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

export interface ImageAttachment {
  /** base64-encoded image data */
  base64: string;
  /** MIME type */
  mediaType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
  /** Source description for UI */
  source: string;
}

const SUPPORTED_EXTENSIONS: Record<string, ImageAttachment['mediaType']> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB

/**
 * Read an image from a file path
 */
export function readImageFromFile(filePath: string): ImageAttachment | null {
  const resolved = resolve(filePath.replace(/^["']|["']$/g, '').trim());
  
  if (!existsSync(resolved)) return null;
  
  const ext = extname(resolved).toLowerCase();
  const mediaType = SUPPORTED_EXTENSIONS[ext];
  if (!mediaType) return null;
  
  const stat = statSync(resolved);
  if (stat.size > MAX_IMAGE_SIZE) return null;
  
  const base64 = readFileSync(resolved).toString('base64');
  return { base64, mediaType, source: resolved };
}

/**
 * Read image from system clipboard (cross-platform)
 * 
 * Windows: PowerShell → Save clipboard image to temp → read
 * macOS: osascript + pngpaste
 * Linux: xclip
 */
export function readImageFromClipboard(): ImageAttachment | null {
  const tempPath = join(tmpdir(), `bobo-clip-${randomBytes(4).toString('hex')}.png`);
  const platform = process.platform;
  
  try {
    if (platform === 'win32') {
      // Windows: use PowerShell to grab clipboard image
      const ps = `
        Add-Type -AssemblyName System.Windows.Forms
        $img = [System.Windows.Forms.Clipboard]::GetImage()
        if ($img -ne $null) {
          $img.Save('${tempPath.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png)
          Write-Output 'OK'
        } else {
          Write-Output 'NO_IMAGE'
        }
      `.trim();
      
      const result = execSync(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`, {
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();
      
      if (result !== 'OK') return null;
      
    } else if (platform === 'darwin') {
      // macOS: try pngpaste first, then osascript
      try {
        execSync(`pngpaste "${tempPath}"`, { timeout: 3000, stdio: 'pipe' });
      } catch {
        // Fallback to osascript
        const script = `
          set theFile to POSIX file "${tempPath}"
          try
            set imgData to the clipboard as «class PNGf»
            set fp to open for access theFile with write permission
            write imgData to fp
            close access fp
          on error
            return "NO_IMAGE"
          end try
          return "OK"
        `.trim();
        const result = execSync(`osascript -e '${script}'`, {
          encoding: 'utf-8',
          timeout: 5000,
        }).trim();
        if (result === 'NO_IMAGE') return null;
      }
      
    } else {
      // Linux: xclip
      try {
        execSync(`xclip -selection clipboard -t image/png -o > "${tempPath}"`, {
          timeout: 3000,
          stdio: 'pipe',
          shell: '/bin/bash',
        });
      } catch {
        return null;
      }
    }
    
    // Read the temp file
    if (!existsSync(tempPath)) return null;
    const stat = statSync(tempPath);
    if (stat.size < 100) return null; // Too small, probably empty
    
    const base64 = readFileSync(tempPath).toString('base64');
    
    // Clean up temp file
    try { execSync(platform === 'win32' ? `del "${tempPath}"` : `rm -f "${tempPath}"`, { stdio: 'pipe' }); } catch { /* ignore */ }
    
    return { base64, mediaType: 'image/png', source: 'clipboard' };
    
  } catch {
    // Clean up on error
    try { execSync(process.platform === 'win32' ? `del "${tempPath}"` : `rm -f "${tempPath}"`, { stdio: 'pipe' }); } catch { /* ignore */ }
    return null;
  }
}

/**
 * Check if input looks like a file path to an image
 */
export function isImagePath(input: string): boolean {
  const cleaned = input.replace(/^["']|["']$/g, '').trim();
  const ext = extname(cleaned).toLowerCase();
  return ext in SUPPORTED_EXTENSIONS && existsSync(resolve(cleaned));
}

/**
 * Build OpenAI-compatible multimodal content array
 */
export function buildImageContent(
  text: string,
  images: ImageAttachment[],
): Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> {
  const content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [];
  
  // Add images first
  for (const img of images) {
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:${img.mediaType};base64,${img.base64}`,
      },
    });
  }
  
  // Add text
  if (text.trim()) {
    content.push({ type: 'text', text: text.trim() });
  }
  
  return content;
}
