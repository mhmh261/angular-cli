/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { buildEsbuildBrowser } from '../../index';
import { BASE_OPTIONS, BROWSER_BUILDER_INFO, describeBuilder } from '../setup';

describeBuilder(buildEsbuildBrowser, BROWSER_BUILDER_INFO, (harness) => {
  describe('Option: "main"', () => {
    it('uses a provided TypeScript file', async () => {
      harness.useTarget('build', {
        ...BASE_OPTIONS,
        main: 'src/main.ts',
      });

      const { result } = await harness.executeOnce();

      expect(result?.success).toBe(true);

      harness.expectFile('dist/main.js').toExist();
      harness.expectFile('dist/index.html').toExist();
    });

    it('uses a provided JavaScript file', async () => {
      await harness.writeFile('src/main.js', `console.log('main');`);

      harness.useTarget('build', {
        ...BASE_OPTIONS,
        main: 'src/main.js',
      });

      const { result } = await harness.executeOnce();

      expect(result?.success).toBe(true);

      harness.expectFile('dist/main.js').toExist();
      harness.expectFile('dist/index.html').toExist();

      harness.expectFile('dist/main.js').content.toContain('console.log("main")');
    });

    it('fails and shows an error when file does not exist', async () => {
      harness.useTarget('build', {
        ...BASE_OPTIONS,
        main: 'src/missing.ts',
      });

      const { result, logs } = await harness.executeOnce({ outputLogsOnFailure: false });

      expect(result?.success).toBe(false);
      expect(logs).toContain(
        jasmine.objectContaining({ message: jasmine.stringMatching('Could not resolve "') }),
      );

      harness.expectFile('dist/main.js').toNotExist();
      harness.expectFile('dist/index.html').toNotExist();
    });

    it('throws an error when given an empty string', async () => {
      harness.useTarget('build', {
        ...BASE_OPTIONS,
        main: '',
      });

      const { result, error } = await harness.executeOnce();
      expect(result).toBeUndefined();

      expect(error?.message).toContain('cannot be an empty string');
    });

    it('resolves an absolute path as relative inside the workspace root', async () => {
      await harness.writeFile('file.mjs', `console.log('Hello!');`);

      harness.useTarget('build', {
        ...BASE_OPTIONS,
        main: '/file.mjs',
      });

      const { result } = await harness.executeOnce();
      expect(result?.success).toBeTrue();

      // Always uses the name `main.js` for the `main` option.
      harness.expectFile('dist/main.js').toExist();
    });
  });
});
