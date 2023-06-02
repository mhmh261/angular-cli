/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import type { OnLoadResult, PartialMessage, ResolveResult } from 'esbuild';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { CompileResult, Exception, Syntax } from 'sass';
import type {
  FileImporterWithRequestContextOptions,
  SassWorkerImplementation,
} from '../../../sass/sass-service';
import { StylesheetLanguage, StylesheetPluginOptions } from './stylesheet-plugin-factory';

let sassWorkerPool: SassWorkerImplementation | undefined;

function isSassException(error: unknown): error is Exception {
  return !!error && typeof error === 'object' && 'sassMessage' in error;
}

export function shutdownSassWorkerPool(): void {
  sassWorkerPool?.close();
  sassWorkerPool = undefined;
}

export const SassStylesheetLanguage = Object.freeze<StylesheetLanguage>({
  name: 'sass',
  componentFilter: /^s[ac]ss;/,
  fileFilter: /\.s[ac]ss$/,
  process(data, file, format, options, build) {
    const syntax = format === 'sass' ? 'indented' : 'scss';
    const resolveUrl = async (url: string, previousResolvedModules?: Set<string>) => {
      let result = await build.resolve(url, {
        kind: 'import-rule',
        // This should ideally be the directory of the importer file from Sass
        // but that is not currently available from the Sass importer API.
        resolveDir: build.initialOptions.absWorkingDir,
      });

      // Workaround to support Yarn PnP without access to the importer file from Sass
      if (!result.path && previousResolvedModules?.size) {
        for (const previous of previousResolvedModules) {
          result = await build.resolve(url, {
            kind: 'import-rule',
            resolveDir: previous,
          });
          if (result.path) {
            break;
          }
        }
      }

      return result;
    };

    return compileString(data, file, syntax, options, resolveUrl);
  },
});

async function compileString(
  data: string,
  filePath: string,
  syntax: Syntax,
  options: StylesheetPluginOptions,
  resolveUrl: (url: string, previousResolvedModules?: Set<string>) => Promise<ResolveResult>,
): Promise<OnLoadResult> {
  // Lazily load Sass when a Sass file is found
  if (sassWorkerPool === undefined) {
    const sassService = await import('../../../sass/sass-service');
    sassWorkerPool = new sassService.SassWorkerImplementation(true);
  }

  const warnings: PartialMessage[] = [];
  try {
    const { css, sourceMap, loadedUrls } = await sassWorkerPool.compileStringAsync(data, {
      url: pathToFileURL(filePath),
      style: 'expanded',
      syntax,
      loadPaths: options.includePaths,
      sourceMap: options.sourcemap,
      sourceMapIncludeSources: options.sourcemap,
      quietDeps: true,
      importers: [
        {
          findFileUrl: async (
            url,
            { previousResolvedModules }: FileImporterWithRequestContextOptions,
          ): Promise<URL | null> => {
            let result = await resolveUrl(url);
            if (result.path) {
              return pathToFileURL(result.path);
            }

            // Check for package deep imports
            const parts = url.split('/');
            const hasScope = parts.length >= 2 && parts[0].startsWith('@');
            const [nameOrScope, nameOrFirstPath, ...pathPart] = parts;
            const packageName = hasScope ? `${nameOrScope}/${nameOrFirstPath}` : nameOrScope;

            let packageResult = await resolveUrl(packageName + '/package.json');

            if (packageResult.path) {
              return pathToFileURL(
                join(
                  dirname(packageResult.path),
                  !hasScope && nameOrFirstPath ? nameOrFirstPath : '',
                  ...pathPart,
                ),
              );
            }

            // Check with Yarn PnP workaround using previous resolved modules.
            // This is done last to avoid a performance penalty for common cases.

            result = await resolveUrl(url, previousResolvedModules);
            if (result.path) {
              return pathToFileURL(result.path);
            }

            packageResult = await resolveUrl(
              packageName + '/package.json',
              previousResolvedModules,
            );

            if (packageResult.path) {
              return pathToFileURL(
                join(
                  dirname(packageResult.path),
                  !hasScope && nameOrFirstPath ? nameOrFirstPath : '',
                  ...pathPart,
                ),
              );
            }

            // Not found
            return null;
          },
        },
      ],
      logger: {
        warn: (text, { deprecation, span }) => {
          warnings.push({
            text: deprecation ? 'Deprecation' : text,
            location: span && {
              file: span.url && fileURLToPath(span.url),
              lineText: span.context,
              // Sass line numbers are 0-based while esbuild's are 1-based
              line: span.start.line + 1,
              column: span.start.column,
            },
            notes: deprecation ? [{ text }] : undefined,
          });
        },
      },
    });

    return {
      loader: 'css',
      contents: sourceMap ? `${css}\n${sourceMapToUrlComment(sourceMap, dirname(filePath))}` : css,
      watchFiles: loadedUrls.map((url) => fileURLToPath(url)),
      warnings,
    };
  } catch (error) {
    if (isSassException(error)) {
      const file = error.span.url ? fileURLToPath(error.span.url) : undefined;

      return {
        loader: 'css',
        errors: [
          {
            text: error.message,
          },
        ],
        warnings,
        watchFiles: file ? [file] : undefined,
      };
    }

    throw error;
  }
}

function sourceMapToUrlComment(
  sourceMap: Exclude<CompileResult['sourceMap'], undefined>,
  root: string,
): string {
  // Remove `file` protocol from all sourcemap sources and adjust to be relative to the input file.
  // This allows esbuild to correctly process the paths.
  sourceMap.sources = sourceMap.sources.map((source) => relative(root, fileURLToPath(source)));

  const urlSourceMap = Buffer.from(JSON.stringify(sourceMap), 'utf-8').toString('base64');

  return `/*# sourceMappingURL=data:application/json;charset=utf-8;base64,${urlSourceMap} */`;
}
