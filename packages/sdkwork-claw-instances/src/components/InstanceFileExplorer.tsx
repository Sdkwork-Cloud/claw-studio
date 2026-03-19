import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, FileCode2, Folder, FolderOpen } from 'lucide-react';
import type { InstanceWorkbenchFile } from '../types';

interface InstanceFileExplorerProps {
  files: InstanceWorkbenchFile[];
  selectedFileId: string | null;
  onSelectFile: (fileId: string) => void;
}

interface FileTreeNode {
  id: string;
  name: string;
  path: string;
  kind: 'directory' | 'file';
  file?: InstanceWorkbenchFile;
  children?: FileTreeNode[];
}

interface MutableTreeNode extends FileTreeNode {
  childrenMap?: Map<string, MutableTreeNode>;
}

function createDirectoryNode(name: string, path: string): MutableTreeNode {
  return {
    id: `dir:${path}`,
    name,
    path,
    kind: 'directory',
    children: [],
    childrenMap: new Map(),
  };
}

function createFileNode(file: InstanceWorkbenchFile): MutableTreeNode {
  return {
    id: file.id,
    name: file.name,
    path: file.path,
    kind: 'file',
    file,
  };
}

function sortTree(nodes: MutableTreeNode[]): FileTreeNode[] {
  return nodes
    .sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === 'directory' ? -1 : 1;
      }

      return a.name.localeCompare(b.name);
    })
    .map((node) => ({
      id: node.id,
      name: node.name,
      path: node.path,
      kind: node.kind,
      file: node.file,
      children: node.children ? sortTree(node.children as MutableTreeNode[]) : undefined,
    }));
}

function buildFileTree(files: InstanceWorkbenchFile[]): FileTreeNode[] {
  const rootNodes = new Map<string, MutableTreeNode>();

  files.forEach((file) => {
    const segments = file.path.split('/').filter(Boolean);
    let currentMap = rootNodes;
    let currentPath = '';
    let parentNode: MutableTreeNode | null = null;

    segments.forEach((segment, index) => {
      currentPath = `${currentPath}/${segment}`;
      const isFile = index === segments.length - 1;

      if (!currentMap.has(currentPath)) {
        const nextNode = isFile ? createFileNode(file) : createDirectoryNode(segment, currentPath);

        currentMap.set(currentPath, nextNode);
        if (parentNode?.children) {
          (parentNode.children as MutableTreeNode[]).push(nextNode);
        }
      }

      const currentNode = currentMap.get(currentPath)!;
      if (!isFile) {
        parentNode = currentNode;
        currentMap = currentNode.childrenMap!;
      }
    });
  });

  return sortTree([...rootNodes.values()]);
}

function getAncestorPaths(path: string) {
  const segments = path.split('/').filter(Boolean);
  return segments.slice(0, -1).map((_, index) => `/${segments.slice(0, index + 1).join('/')}`);
}

function collectDirectoryPaths(nodes: FileTreeNode[]): string[] {
  return nodes.flatMap((node) => {
    if (node.kind !== 'directory') {
      return [];
    }

    return [node.path, ...collectDirectoryPaths(node.children || [])];
  });
}

export function InstanceFileExplorer({
  files,
  selectedFileId,
  onSelectFile,
}: InstanceFileExplorerProps) {
  const tree = useMemo(() => buildFileTree(files), [files]);
  const selectedFile = useMemo(
    () => files.find((file) => file.id === selectedFileId) || null,
    [files, selectedFileId],
  );
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const directoryPaths = collectDirectoryPaths(tree);
    const selectedAncestors = selectedFile ? getAncestorPaths(selectedFile.path) : [];

    setExpandedPaths((current) => {
      const next = { ...current };

      directoryPaths.forEach((path) => {
        if (!(path in next)) {
          next[path] = true;
        }
      });

      selectedAncestors.forEach((path) => {
        next[path] = true;
      });

      return next;
    });
  }, [selectedFile, tree]);

  const toggleDirectory = (path: string) => {
    setExpandedPaths((current) => ({
      ...current,
      [path]: !current[path],
    }));
  };

  const renderNodes = (nodes: FileTreeNode[], depth = 0) =>
    nodes.map((node) => {
      if (node.kind === 'directory') {
        const isExpanded = expandedPaths[node.path] ?? true;

        return (
          <div key={node.id}>
            <button
              type="button"
              data-slot="instance-files-tree-node"
              data-node-kind="directory"
              onClick={() => toggleDirectory(node.path)}
              className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-950/[0.05] dark:text-zinc-200 dark:hover:bg-white/[0.06]"
              style={{ paddingLeft: `${depth * 14 + 10}px` }}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
              )}
              {isExpanded ? (
                <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
              ) : (
                <Folder className="h-4 w-4 shrink-0 text-amber-500" />
              )}
              <span className="truncate">{node.name}</span>
            </button>

            {isExpanded ? <div>{renderNodes(node.children || [], depth + 1)}</div> : null}
          </div>
        );
      }

      const isActive = node.file?.id === selectedFileId;

      return (
        <button
          key={node.id}
          type="button"
          data-slot="instance-files-tree-node"
          data-node-kind="file"
          onClick={() => onSelectFile(node.id)}
          className={`flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition-colors ${
            isActive
              ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
              : 'text-zinc-700 hover:bg-zinc-950/[0.05] dark:text-zinc-200 dark:hover:bg-white/[0.06]'
          }`}
          style={{ paddingLeft: `${depth * 14 + 34}px` }}
        >
          <FileCode2 className="h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{node.name}</div>
            <div
              className={`truncate text-[11px] ${
                isActive ? 'text-white/70 dark:text-zinc-700' : 'text-zinc-500 dark:text-zinc-400'
              }`}
            >
              {node.file?.status}
            </div>
          </div>
        </button>
      );
    });

  return (
    <div data-slot="instance-files-tree" className="space-y-1">
      {renderNodes(tree)}
    </div>
  );
}
