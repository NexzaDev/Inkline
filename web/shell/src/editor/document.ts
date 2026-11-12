export interface GraphDocument {
  readonly name: string;
  readonly xml: string;
}

export async function readGraphDocument(file: File): Promise<GraphDocument> {
  const xml = await file.text();

  if (!looksLikeGraphDocument(xml)) {
    throw new Error(`${file.name} is not a graph document`);
  }

  return { name: file.name, xml };
}

export function looksLikeGraphDocument(xml: string): boolean {
  return rootElement(xml).startsWith("<mxfile") || rootElement(xml).startsWith("<mxGraphModel");
}

function rootElement(xml: string): string {
  const body = xml.trimStart();
  const declaration = body.startsWith("<?xml") ? body.indexOf("?>") : -1;

  return declaration === -1 ? body : body.slice(declaration + 2).trimStart();
}
