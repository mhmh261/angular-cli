/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { SchematicTestRunner, UnitTestTree } from '@angular-devkit/schematics/testing';
import { Schema as ApplicationOptions } from '../application/schema';
import { Schema as WorkspaceOptions } from '../workspace/schema';
import { Schema as EnumOptions } from './schema';

describe('Enum Schematic', () => {
  const schematicRunner = new SchematicTestRunner(
    '@schematics/angular',
    require.resolve('../collection.json'),
  );
  const defaultOptions: EnumOptions = {
    name: 'foo',
    project: 'bar',
  };

  const workspaceOptions: WorkspaceOptions = {
    name: 'workspace',
    newProjectRoot: 'projects',
    version: '6.0.0',
  };

  const appOptions: ApplicationOptions = {
    name: 'bar',
    inlineStyle: false,
    inlineTemplate: false,
    routing: false,
    skipTests: false,
    skipPackageJson: false,
  };
  let appTree: UnitTestTree;
  beforeEach(async () => {
    appTree = await schematicRunner.runSchematic('workspace', workspaceOptions);
    appTree = await schematicRunner.runSchematic('application', appOptions, appTree);
  });

  it('should create an enumeration', async () => {
    const tree = await schematicRunner.runSchematic('enum', defaultOptions, appTree);

    const files = tree.files;
    expect(files).toContain('/projects/bar/src/app/foo.ts');
  });

  it('should create an enumeration', async () => {
    const tree = await schematicRunner.runSchematic('enum', defaultOptions, appTree);

    const content = tree.readContent('/projects/bar/src/app/foo.ts');
    expect(content).toMatch('export enum Foo {');
  });

  it('should respect the sourceRoot value', async () => {
    const config = JSON.parse(appTree.readContent('/angular.json'));
    config.projects.bar.sourceRoot = 'projects/bar/custom';
    appTree.overwrite('/angular.json', JSON.stringify(config, null, 2));
    appTree = await schematicRunner.runSchematic('enum', defaultOptions, appTree);
    expect(appTree.files).toContain('/projects/bar/custom/app/foo.ts');
  });

  it('should put type in the file name', async () => {
    const options = { ...defaultOptions, type: 'enum' };

    const tree = await schematicRunner.runSchematic('enum', options, appTree);
    expect(tree.files).toContain('/projects/bar/src/app/foo.enum.ts');
  });

  it('should error when class name contains invalid characters', async () => {
    const options = { ...defaultOptions, name: '1Clazz' };

    await expectAsync(schematicRunner.runSchematic('enum', options, appTree)).toBeRejectedWithError(
      'Class name "1Clazz" is invalid.',
    );
  });
});
