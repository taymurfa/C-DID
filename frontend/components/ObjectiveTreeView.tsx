'use client';

import Link from 'next/link';
import { ObjectiveTree } from '@/lib/api';

interface ObjectiveTreeViewProps {
  node: ObjectiveTree;
  depth?: number;
}

function LevelBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    strategic: 'bg-purple-100 text-purple-800',
    functional: 'bg-blue-100 text-blue-800',
    tactical: 'bg-green-100 text-green-800',
  };
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${colors[level] || 'bg-gray-100 text-gray-800'}`}>
      {level}
    </span>
  );
}

export default function ObjectiveTreeView({ node, depth = 0 }: ObjectiveTreeViewProps) {
  const paddingLeft = depth * 24;

  return (
    <div className="border-l-2 border-gray-200 pl-4" style={{ marginLeft: paddingLeft }}>
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/okrs/${node._id}`}
            className="font-medium text-indigo-600 hover:text-indigo-800"
          >
            {node.title}
          </Link>
          <LevelBadge level={node.level} />
          {node.quarter && <span className="text-xs text-gray-500">{node.quarter}</span>}
          {node.averageScore != null && (
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
              Avg score: {node.averageScore}
            </span>
          )}
        </div>
        {node.description && (
          <p className="mt-1 text-sm text-gray-600">{node.description}</p>
        )}
        {node.keyResults && node.keyResults.length > 0 && (
          <div className="mt-2">
            <p className="text-xs font-medium text-gray-500">Key Results</p>
            <ul className="mt-1 space-y-1 text-sm text-gray-700">
              {node.keyResults.map((kr) => (
                <li key={kr._id} className="flex items-center gap-2">
                  <span>{kr.title}</span>
                  {kr.score != null && (
                    <span className="text-gray-500">({kr.score})</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {node.children && node.children.length > 0 && (
        <div className="mt-3 space-y-3">
          {node.children.map((child) => (
            <ObjectiveTreeView key={child._id} node={child as ObjectiveTree} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
