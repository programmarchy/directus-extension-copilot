type SpecificationService = {
  oas: {
    generate: () => Promise<any>;
  };
}

type Options = {
  allowMethods?: RegExp[];
  allowPaths?: RegExp[];
};

export async function getDirectusOpenAPISpec({ specService }: { specService: SpecificationService }, options: Options = {}) {
  const spec = await specService.oas.generate();
  const reducedSpec = reduceDirectusOpenAPISpec(spec, options);
  const augmentedSpec = augmentDirectusOpenAPISpec(reducedSpec);
  const dereferencedSpec = await dereferenceSpec(augmentedSpec);
  return dereferencedSpec;
}

// The size of the schema must be reduced to fit within the OpenAI API limits (48 functions).
// We can do this by removing schemas, paths, and operations that we do not need.
function reduceDirectusOpenAPISpec(
  spec: any,
  {
    // By default, we only want to answer questions, so GET requests should be sufficient.
    // Therefore, do not allow other methods like POST, PATCH, or DELETE.
    allowMethods = [
      /GET/i,
    ],
    // Also, we only want to answer questions about the following paths. In the future,
    // it might be interesting to answer questions about other paths, but we would need
    // to use a smarter agent-based model that can determine which paths are relevant.
    allowPaths = [
      /^\/activity.*/i,
      /^\/assets.*/i,
      // /^\/auth.*/i,
      /^\/collections.*/i,
      // /^\/extensions.*/i,
      /^\/fields.*/i,
      /^\/files.*/i,
      // /^\/flows.*/i,
      /^\/folders.*/i,
      /^\/items.*/i,
      // /^\/operations.*/i,
      // /^\/permissions.*/i,
      // /^\/presets.*/i,
      /^\/relations.*/i,
      /^\/revisions.*/i,
      /^\/roles.*/i,
      // /^\/schema.*/i,
      // /^\/server.*/i,
      // /^\/settings.*/i,
      /^\/users.*/i,
      // /^\/utils.*/i,
      // /^\/webhooks.*/i,
    ],
  }: Options
): any {
  const {
    paths,
    ...otherSpec
  } = spec;

  return {
    ...otherSpec,
    paths: Object.fromEntries(
      Object.entries<any>(paths)
        .filter(([name]) => allowPaths.some((regex) => regex.test(name)))
        .map(([name, path]) => [
          name,
          Object.fromEntries(
            Object.entries<any>(path)
              .filter(([method]) => allowMethods.some((regex) => regex.test(method))),
          ),
        ])
        .filter(([_, path]) =>
          path && Object.keys(path).length > 0
        )
    ),
  };
}

function augmentDirectusOpenAPISpec(spec: any): any {
  // Provide a hint about which meta fields are available.
  const metaSchema = spec?.components?.parameters?.Meta?.schema;
  if (metaSchema) {
    metaSchema.enum = [
      "total_count",
      "filter_count",
    ];
  }
  return spec;
}

function dereferenceSpec(spec: any): any {
  // Recursively dereference all $ref fields in the spec.

  function getRef(path: string): any {
    const [prefix, ...components] = path.split('/');
    if (prefix !== '#') {
      throw new Error(`Invalid ref path.`);
    }
    let objOut = spec;
    for (const component of components) {
      objOut = objOut[component];
    }
    return objOut;
  }
  
  function dereferenceRefs(objIn: any, stop: boolean = false): any {
    if (stop) {
      return objIn;
    }

    if (objIn === undefined || objIn === null) {
      return objIn;
    }

    if (typeof objIn === 'object') {
      const objOut: Record<string, any> = {};
      for (const [k, v] of Object.entries<any>(objIn)) {
        if (k === '$ref') {
          return dereferenceRefs(getRef(v), true);
        } else if (Array.isArray(v)) {
          objOut[k] = v.map((v) => dereferenceRefs(v));
        } else if (typeof v === 'object') {
          objOut[k] = dereferenceRefs(v);
        } else {
          objOut[k] = v;
        }
      }
      return objOut;
    } else if (Array.isArray(objIn)) {
      return objIn.map((v) => dereferenceRefs(v));
    } else {
      return objIn;
    }
  }

  return dereferenceRefs(spec);
}

export type OperationInfo = {
  path: string;
  method: string;
  description?: string;
}

export function getOperationInfoMap(spec: any): Map<string, OperationInfo> {
  const map = new Map();
  for (const path in spec.paths) {
    for (const method in spec.paths[path]) {
      const operation = spec.paths[path][method];
      map.set(operation.operationId, {
        path,
        method,
        description: operation.description,
      });
    }
  }
  return map;
}
