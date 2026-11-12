
import DocumentEditor from "./document-editor";

export const instant = false;

type Props = {
  params: Promise<{ id: string }>;
};

export default async function DocumentPage({ params }: Props) {
  const { id } = await params;

  return <DocumentEditor id={id} />;
}
