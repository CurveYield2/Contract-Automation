import { collectSoliditySources, compileProject } from './compiler.mjs';
import { compileRepoNativeHardhat, detectNativeBuild } from './native-build.mjs';

function requestedSolidityCompiler(request) {
  const compilers = request?.configuration?.compilers ?? [];
  const compiler = compilers.find((item) => item?.language === 'solidity');
  if (!compiler?.version) throw new Error('Exact Solidity compiler version is required');
  return compiler;
}

export async function buildProject({
  projectRoot,
  request,
  runCommand,
  fsApi,
  compileStandardJson = compileProject,
  collectSources = collectSoliditySources
}) {
  const compiler = requestedSolidityCompiler(request);
  const detected = await detectNativeBuild(projectRoot, { ...(fsApi ? { fsApi } : {}) });
  if (detected.system === 'hardhat-native') {
    const native = await compileRepoNativeHardhat({
      projectRoot,
      ...(runCommand ? { runCommand } : {}),
      ...(fsApi ? { fsApi } : {})
    });
    return {
      ...native,
      compilerVersion: compiler.version
    };
  }

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
  return {
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
