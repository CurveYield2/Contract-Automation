import { collectSoliditySources, compileProject } from './compiler.mjs';
import { compileRepoHermeticStandardJson, shouldUseHermeticStandardJson } from './hermetic-standard-json.mjs';
import { compileRepoNativeHardhat, detectNativeBuild } from './native-build.mjs';
import { compileVyperSources as defaultCompileVyperSources } from './vyper-build.mjs';

export { compileVyperSources } from './vyper-build.mjs';

function requestedSolidityCompiler(request) {
  const compilers = request?.configuration?.compilers ?? [];
  const compiler = compilers.find((item) => item?.language === 'solidity');
  if (!compiler?.version) throw new Error('Exact Solidity compiler version is required');
  return compiler;
}

function requestedVyperCompiler(request) {
  const compilers = request?.configuration?.compilers ?? [];
  return compilers.find((item) => item?.language === 'vyper') ?? null;
}

function mergeArtifacts(solidityArtifacts, vyperArtifacts) {
  const merged = [];
  const seen = new Set();
  for (const artifact of [...(solidityArtifacts ?? []), ...(vyperArtifacts ?? [])]) {
    const key = `${artifact.sourceName}:${artifact.contractName}`;
    if (seen.has(key)) throw new Error(`Duplicate mixed-language compiler artifact: ${key}`);
    seen.add(key);
    merged.push(artifact);
  }
  return merged;
}

export async function buildProject({
  projectRoot,
  request,
  runCommand,
  fsApi,
  compileStandardJson = compileProject,
  collectSources = collectSoliditySources,
  compileVyper = defaultCompileVyperSources,
  compileHermetic = compileRepoHermeticStandardJson
}) {
  const compiler = requestedSolidityCompiler(request);
  const detected = await detectNativeBuild(projectRoot, { ...(fsApi ? { fsApi } : {}) });
  let solidityBuild;

  if (shouldUseHermeticStandardJson(request)) {
    solidityBuild = await compileHermetic({
      projectRoot,
      request,
      ...(runCommand ? { runCommand } : {}),
      ...(fsApi ? { fsApi } : {})
    });
  } else if (detected.system === 'hardhat-native') {
    const native = await compileRepoNativeHardhat({
      projectRoot,
      ...(runCommand ? { runCommand } : {}),
      ...(fsApi ? { fsApi } : {})
    });
    solidityBuild = {
      ...native,
      compilerVersion: compiler.version
    };
  } else {
    const sources = await collectSources(projectRoot);
    const compiled = await compileStandardJson({
      sources,
      compilerVersion: compiler.version,
      settings: {
        optimizer: request.configuration.optimizer,
        evmVersion: request.configuration.evmVersion,
        viaIR: request.configuration.viaIR
      }
    });
    solidityBuild = {
      status: 'completed',
      system: 'solc-standard-json',
      compilerVersion: compiler.version,
      compilerDiagnostics: compiled.diagnostics,
      compilerInput: compiled.input,
      artifacts: compiled.artifacts.all,
      sourceInventory: Object.keys(sources).sort(),
      sourceInventoryFiles: Object.keys(sources).length
    };
  }

  const vyperCompiler = requestedVyperCompiler(request);
  if (!vyperCompiler) return solidityBuild;

  const vyperBuild = await compileVyper({
    projectRoot,
    compiler: vyperCompiler,
    evmVersion: request.configuration.evmVersion,
    ...(runCommand ? { runCommand } : {}),
    ...(fsApi ? { fsApi } : {})
  });
  const sourceInventory = [...new Set([
    ...(solidityBuild.sourceInventory ?? []),
    ...(vyperBuild.sourceInventory ?? [])
  ])].sort();

  return {
    ...solidityBuild,
    artifacts: mergeArtifacts(solidityBuild.artifacts, vyperBuild.artifacts),
    sourceInventory,
    sourceInventoryFiles: sourceInventory.length,
    vyperBuild
  };
}
