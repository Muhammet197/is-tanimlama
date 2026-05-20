import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { api } from '../api';

function JobNode({ data }) {
  const diffColors = { 'Kolay': '#d1fae5', 'Orta': '#fef3c7', 'Karmaşık': '#fee2e2' };
  return (
    <div style={{
      padding: '12px 16px', borderRadius: 8, background: '#fff',
      border: `2px solid ${data.color}`, boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      minWidth: 180, textAlign: 'center'
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{data.label}</div>
      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
        {data.group && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: data.color + '20', color: data.color }}>{data.group}</span>}
        {data.difficulty && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: diffColors[data.difficulty] || '#f1f5f9' }}>{data.difficulty}</span>}
      </div>
    </div>
  );
}

const nodeTypes = { jobNode: JobNode };

export default function GraphView() {
  const navigate = useNavigate();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    api.graph.get().then(data => {
      setNodes(data.nodes);
      setEdges(data.edges);
    }).catch(() => {});
  }, []);

  const onNodeClick = useCallback((_, node) => {
    navigate(`/jobs/${node.id}`);
  }, [navigate]);

  return (
    <div>
      <div className="page-header">
        <h1>Bagimlilik Haritasi</h1>
      </div>
      <div className="graph-container">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-left"
        >
          <Controls />
          <MiniMap />
          <Background variant="dots" gap={12} size={1} />
        </ReactFlow>
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
        <span><span style={{ display: 'inline-block', width: 12, height: 3, background: '#10b981', marginRight: 4, verticalAlign: 'middle' }}></span> Girdi saglar</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 3, background: '#3b82f6', marginRight: 4, verticalAlign: 'middle' }}></span> Sirali</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 3, background: '#f59e0b', marginRight: 4, verticalAlign: 'middle' }}></span> Bilgi paylasimi</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 3, background: '#ef4444', marginRight: 4, verticalAlign: 'middle' }}></span> Onay gerektirir</span>
      </div>
    </div>
  );
}
