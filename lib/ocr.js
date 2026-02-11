#!/usr/bin/env node
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

class OCR {
  /**
   * Extract text from image using macOS Vision API
   * @param {string} imagePath - Path to image file
   * @returns {Promise<string>} - Extracted text
   */
  static async extractText(imagePath) {
    try {
      // Verify file exists
      await fs.access(imagePath);

      // Create temporary Swift script for Vision API
      const swiftScript = `
import Vision
import AppKit

let imageURL = URL(fileURLWithPath: "${imagePath}")
guard let image = NSImage(contentsOf: imageURL),
      let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    print("ERROR: Failed to load image")
    exit(1)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])

do {
    try handler.perform([request])

    guard let observations = request.results as? [VNRecognizedTextObservation] else {
        print("")
        exit(0)
    }

    let recognizedText = observations.compactMap { observation in
        observation.topCandidates(1).first?.string
    }.joined(separator: "\\n")

    print(recognizedText)
} catch {
    print("ERROR: \\(error.localizedDescription)")
    exit(1)
}
`;

      // Write Swift script to temporary file
      const tmpDir = path.join('/tmp', 'screen-story-ocr');
      await fs.mkdir(tmpDir, { recursive: true });
      const scriptPath = path.join(tmpDir, 'ocr.swift');
      await fs.writeFile(scriptPath, swiftScript);

      // Execute Swift script
      const { stdout, stderr } = await execAsync(`swift ${scriptPath}`);

      if (stderr && stderr.includes('ERROR')) {
        throw new Error(stderr);
      }

      return stdout.trim();
    } catch (error) {
      console.error('OCR extraction error:', error.message);
      return ''; // Return empty string on error
    }
  }

  /**
   * Extract text with bounding boxes (for future redaction feature)
   * @param {string} imagePath - Path to image file
   * @returns {Promise<Array>} - Array of {text, bounds: {x, y, width, height}}
   */
  static async extractTextWithBounds(imagePath) {
    try {
      await fs.access(imagePath);

      const swiftScript = `
import Vision
import AppKit
import Foundation

let imageURL = URL(fileURLWithPath: "${imagePath}")
guard let image = NSImage(contentsOf: imageURL),
      let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    print("[]")
    exit(0)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])

do {
    try handler.perform([request])

    guard let observations = request.results as? [VNRecognizedTextObservation] else {
        print("[]")
        exit(0)
    }

    let imageWidth = CGFloat(cgImage.width)
    let imageHeight = CGFloat(cgImage.height)

    var results: [[String: Any]] = []

    for observation in observations {
        guard let candidate = observation.topCandidates(1).first else { continue }

        let bounds = observation.boundingBox

        // Convert normalized coordinates to pixel coordinates
        let x = bounds.origin.x * imageWidth
        let y = (1 - bounds.origin.y - bounds.height) * imageHeight
        let width = bounds.width * imageWidth
        let height = bounds.height * imageHeight

        results.append([
            "text": candidate.string,
            "confidence": candidate.confidence,
            "bounds": [
                "x": x,
                "y": y,
                "width": width,
                "height": height
            ]
        ])
    }

    if let jsonData = try? JSONSerialization.data(withJSONObject: results),
       let jsonString = String(data: jsonData, encoding: .utf8) {
        print(jsonString)
    } else {
        print("[]")
    }
} catch {
    print("[]")
}
`;

      const tmpDir = path.join('/tmp', 'screen-story-ocr');
      await fs.mkdir(tmpDir, { recursive: true });
      const scriptPath = path.join(tmpDir, 'ocr-bounds.swift');
      await fs.writeFile(scriptPath, swiftScript);

      const { stdout } = await execAsync(`swift ${scriptPath}`);

      try {
        return JSON.parse(stdout.trim() || '[]');
      } catch {
        return [];
      }
    } catch (error) {
      console.error('OCR bounds extraction error:', error.message);
      return [];
    }
  }

  /**
   * Check if OCR is available (macOS 10.15+)
   * @returns {Promise<boolean>}
   */
  static async isAvailable() {
    try {
      // Try to compile a simple Swift + Vision script
      const testScript = `
import Vision
print("OK")
`;
      const tmpPath = '/tmp/test-vision.swift';
      await fs.writeFile(tmpPath, testScript);

      const { stdout } = await execAsync(`swift ${tmpPath}`);
      return stdout.trim() === 'OK';
    } catch (error) {
      return false;
    }
  }
}

export default OCR;
