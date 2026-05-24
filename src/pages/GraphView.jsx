import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Filter, X, Plus, Trash2, Info, User, Clock, Layers, ArrowRight, Eye, EyeOff, LayoutGrid } from 'lucide-react';
import { api } from '../api';

const DEP_TYPES = ['Girdi sağlar', 'Sıralı', 'Bilgi paylaşımı', 'Onay gerektirir'];
const EDGE_COLORS = { 'Girdi sağlar': '#10b981', 'Sıralı': '#3b82f6', 'Bilgi paylaşımı': '#f59e0b', 'Onay gerektirir': '#ef4444' };
const DIFF_COLORS = { 'Kolay': { bg: '#d1fae5', text: '#065f46' }, 'Orta': { bg: '#fef3c7', text: '#92400e' }, 'Karmaşık': { bg: '#fee2e2', text: '#991b1b' } };

// ─── Custom Node ────────────────────────────────────────
function JobNode({ data, selected }) {
  const [hovered, setHovered] = useState(false);
  const diff = DIFF_COLORS[data.difficulty] || { bg: '#f1f5f9', text: '#475569' };
  const borderWidth = data.difficulty === 'Karmaşık' ? 3 : data.difficulty === 'Orta' ? 2 : 1.5;
  const minW = data.difficulty === 'Karmaşık' ? 220 : data.difficulty === 'Orta' ? 200 : 180;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '14px 18px', borderRadius: 10, background: '#fff',
        border: `${borderWidth}px solid ${selected ? '#1e293b' : data.color}`,
        boxShadow: selected ? '0 0 0 2px #3b82f6, 0 4px 12px rgba(0,0,0,0.12)' : hovered ? '0 6px 16px rgba(0,0,0,0.12)' : '0 2px 8px rgba(0,0,0,0.06)',
        minWidth: minW, textAlign: 'center', transition: 'all 0.15s', position: 'relative',
        transform: hovered ? 'scale(1.03)' : 'scale(1)',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: data.color, width: 10, height: 10, border: '2px solid #fff' }} />
      <Handle type="source" position={Position.Right} style={{ background: data.color, width: 10, height: 10, border: '2px solid #fff' }} />

      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, lineHeight: 1.3 }}>{data.label}</div>
      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
        {data.group && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: data.color + '18', color: data.color, fontWeight: 600 }}>{data.group}</span>}
        {data.difficulty && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: diff.bg, color: diff.text, fontWeight: 600 }}>{data.difficulty}</span>}
      </div>
      {data.responsible && (
        <div style={{ fontSize: 10, color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
          <User size={10} /> {data.responsible}
          {data.stepCount > 0 && <span style={{ marginLeft: 6 }}>• {data.stepCount} adim</span>}
        </div>
      )}

      {/* Tooltip */}
      {hovered && (
        <div style={{
          position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%)',
          background: '#1e293b', color: '#fff', padding: '10px 14px', borderRadius: 8,
          fontSize: 11, whiteSpace: 'nowrap', zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          pointerEvents: 'none', lineHeight: 1.6
        }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>{data.label}</div>
          {data.responsible && <div>Sorumlu: {data.responsible}</div>}
          {data.period && <div>Periyot: {data.period}</div>}
          {data.estimatedDuration && <div>Sure: {data.estimatedDuration}</div>}
          {data.stepCount > 0 && <div>Adim: {data.stepCount}</div>}
          {data.environments?.length > 0 && <div>Ortam: {data.environments.join(', ')}</div>}
          <div>Bagimlilik: {data.inDeps} gelen, {data.outDeps} giden</div>
          <div style={{ position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%) rotate(45deg)', width: 10, height: 10, background: '#1e293b' }} />
        </div>
      )}
    </div>
  );
}

const nodeTypes = { jobNode: JobNode };

// ─── Main Component ─────────────────────────────────────
export default function GraphView() {
  const navigate = useNavigate();
  const [allNodes, setAllNodes] = useState([]);
  const [allEdges, setAllEdges] = useState([]);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [groups, setGroups] = useState([]);
  const [responsibles, setResponsibles] = useState([]);

  // Filters
  const [groupFilter, setGroupFilter] = useState('');
  const [responsibleFilter, setResponsibleFilter] = useState('');
  const [hideIsolated, setHideIsolated] = useState(false);

  // Detail panel
  const [selectedNode, setSelectedNode] = useState(null);

  // Add dependency modal
  const [showAddDep, setShowAddDep] = useState(false);
  const [newDep, setNewDep] = useState({ from: '', to: '', type: 'Sıralı', description: '' });

  // Edge delete
  const [selectedEdge, setSelectedEdge] = useState(null);

  const load = () => {
    api.graph.get().then(data => {
      setAllNodes(data.nodes);
      setAllEdges(data.edges);
      setGroups(data.groups || []);
      setResponsibles(data.responsibles || []);
    }).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  // Apply filters
  useEffect(() => {
    let filteredNodes = [...allNodes];
    let filteredEdges = [...allEdges];

    if (groupFilter) {
      filteredNodes = filteredNodes.filter(n => String(n.data.groupId) === groupFilter);
      const nodeIds = new Set(filteredNodes.map(n => n.id));
      filteredEdges = filteredEdges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
    }

    if (responsibleFilter) {
      filteredNodes = filteredNodes.filter(n => n.data.responsible === responsibleFilter);
      const nodeIds = new Set(filteredNodes.map(n => n.id));
      filteredEdges = filteredEdges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
    }

    if (hideIsolated) {
      const connectedIds = new Set();
      filteredEdges.forEach(e => { connectedIds.add(e.source); connectedIds.add(e.target); });
      filteredNodes = filteredNodes.filter(n => connectedIds.has(n.id));
    }

    setNodes(filteredNodes);
    setEdges(filteredEdges);
  }, [allNodes, allEdges, groupFilter, responsibleFilter, hideIsolated]);

  // Stats
  const stats = useMemo(() => ({
    totalNodes: nodes.length,
    totalEdges: edges.length,
    isolated: nodes.filter(n => !edges.some(e => e.source === n.id || e.target === n.id)).length,
    mostConnected: nodes.reduce((max, n) => {
      const count = (n.data.inDeps || 0) + (n.data.outDeps || 0);
      return count > (max.count || 0) ? { label: n.data.label, count } : max;
    }, { label: '-', count: 0 })
  }), [nodes, edges]);

  const onNodeClick = useCallback((_, node) => {
    setSelectedNode(node);
    setSelectedEdge(null);
  }, []);

  const onEdgeClick = useCallback((_, edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  // Drag to connect
  const onConnect = useCallback((params) => {
    setNewDep({ from: params.source, to: params.target, type: 'Sıralı', description: '' });
    setShowAddDep(true);
  }, []);

  const handleAddDep = async () => {
    if (!newDep.from || !newDep.to) return;
    try {
      await api.dependencies.create({
        from_job_id: parseInt(newDep.from),
        to_job_id: parseInt(newDep.to),
        type: newDep.type,
        description: newDep.description
      });

      // Log dependency on both jobs
      const fromNode = allNodes.find(n => n.id === newDep.from);
      const toNode = allNodes.find(n => n.id === newDep.to);
      const today = new Date().toISOString().slice(0, 10);
      const fromTitle = fromNode?.data?.label || newDep.from;
      const toTitle = toNode?.data?.label || newDep.to;

      await api.jobs.addHistory(newDep.from, {
        date: today, person: 'Sistem',
        note: `Bagimlilik eklendi: → ${toTitle} (${newDep.type})`
      }).catch(() => {});
      await api.jobs.addHistory(newDep.to, {
        date: today, person: 'Sistem',
        note: `Bagimlilik eklendi: ${fromTitle} → (${newDep.type})`
      }).catch(() => {});

      setShowAddDep(false);
      setNewDep({ from: '', to: '', type: 'Sıralı', description: '' });
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleDeleteEdge = async () => {
    if (!selectedEdge) return;
    const depId = selectedEdge.depId || selectedEdge.id.replace('e', '');
    try {
      // Log before deleting
      const today = new Date().toISOString().slice(0, 10);
      const sourceNode = allNodes.find(n => n.id === selectedEdge.source);
      const targetNode = allNodes.find(n => n.id === selectedEdge.target);
      const edgeType = selectedEdge.data?.type || selectedEdge.label || '';

      await api.dependencies.delete(depId);

      if (sourceNode) {
        await api.jobs.addHistory(selectedEdge.source, {
          date: today, person: 'Sistem',
          note: `Bagimlilik kaldirildi: → ${targetNode?.data?.label || ''} (${edgeType})`
        }).catch(() => {});
      }
      if (targetNode) {
        await api.jobs.addHistory(selectedEdge.target, {
          date: today, person: 'Sistem',
          note: `Bagimlilik kaldirildi: ${sourceNode?.data?.label || ''} → (${edgeType})`
        }).catch(() => {});
      }

      setSelectedEdge(null);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const clearFilters = () => {
    setGroupFilter('');
    setResponsibleFilter('');
    setHideIsolated(false);
  };

  const hasFilters = groupFilter || responsibleFilter || hideIsolated;

  return (
    <div>
      <div className="page-header">
        <h1>Bagimlilik Haritasi</h1>
        <button className="btn btn-primary btn-sm" onClick={() => { setNewDep({ from: '', to: '', type: 'Sıralı', description: '' }); setShowAddDep(true); }}>
          <Plus size={14} /> Bagimlilik Ekle
        </button>
      </div>

      {/* Stats Bar */}
      <div className="graph-stats">
        <div className="graph-stat"><span className="graph-stat-value">{stats.totalNodes}</span><span className="graph-stat-label">Is</span></div>
        <div className="graph-stat"><span className="graph-stat-value">{stats.totalEdges}</span><span className="graph-stat-label">Bagimlilik</span></div>
        <div className="graph-stat"><span className="graph-stat-value">{stats.isolated}</span><span className="graph-stat-label">Izole</span></div>
        <div className="graph-stat"><span className="graph-stat-value" title={stats.mostConnected.label}>{stats.mostConnected.count}</span><span className="graph-stat-label">En Cok Bagli</span></div>
      </div>

      {/* Filters */}
      <div className="graph-toolbar">
        <div className="graph-filters">
          <Filter size={14} style={{ color: '#64748b' }} />
          <select className="filter-select" value={groupFilter} onChange={e => setGroupFilter(e.target.value)} style={{ fontSize: 13 }}>
            <option value="">Tum Gruplar</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select className="filter-select" value={responsibleFilter} onChange={e => setResponsibleFilter(e.target.value)} style={{ fontSize: 13 }}>
            <option value="">Tum Sorumlular</option>
            {responsibles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button
            className={`btn btn-sm ${hideIsolated ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setHideIsolated(!hideIsolated)}
            title="Izole node'lari gizle/goster"
          >
            {hideIsolated ? <EyeOff size={13} /> : <Eye size={13} />} Izole
          </button>
          {hasFilters && (
            <button className="btn btn-sm btn-secondary" onClick={clearFilters}><X size={13} /> Temizle</button>
          )}
        </div>
      </div>

      {/* Graph + Detail Panel */}
      <div style={{ display: 'flex', gap: 16 }}>
        <div className="graph-container" style={{ flex: 1, height: selectedNode ? 'calc(100vh - 260px)' : 'calc(100vh - 260px)' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            attributionPosition="bottom-left"
            connectionLineStyle={{ stroke: '#94a3b8', strokeWidth: 2 }}
            defaultEdgeOptions={{ type: 'smoothstep', animated: true }}
          >
            <Controls />
            <MiniMap
              nodeColor={n => n.data?.color || '#3b82f6'}
              maskColor="rgba(0,0,0,0.08)"
              style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
            <Background variant="dots" gap={16} size={1} color="#cbd5e1" />
          </ReactFlow>

          {/* Legend overlay */}
          <div className="graph-legend">
            <div className="graph-legend-title">Bagimlilik Turleri</div>
            {DEP_TYPES.map(t => (
              <div key={t} className="graph-legend-item">
                <span className="graph-legend-line" style={{ background: EDGE_COLORS[t] }}></span>
                <span>{t}</span>
              </div>
            ))}
            <div className="graph-legend-title" style={{ marginTop: 8 }}>Zorluk (kenarlik kalinligi)</div>
            <div className="graph-legend-item"><span style={{ width: 12, height: 2, background: '#94a3b8', display: 'inline-block', marginRight: 6 }}></span> Kolay</div>
            <div className="graph-legend-item"><span style={{ width: 12, height: 3, background: '#94a3b8', display: 'inline-block', marginRight: 6 }}></span> Orta</div>
            <div className="graph-legend-item"><span style={{ width: 12, height: 4, background: '#94a3b8', display: 'inline-block', marginRight: 6 }}></span> Karmasik</div>
          </div>

          {/* Edge delete popup */}
          {selectedEdge && (
            <div className="graph-edge-popup">
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{selectedEdge.data?.type || 'Bagimlilik'}</div>
              {selectedEdge.data?.description && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{selectedEdge.data.description}</div>}
              <button className="btn btn-danger btn-sm" onClick={handleDeleteEdge}><Trash2 size={12} /> Bagimliligi Sil</button>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedNode && (
          <div className="graph-detail-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3 }}>{selectedNode.data.label}</h3>
              <button className="btn-icon" onClick={() => setSelectedNode(null)}><X size={16} /></button>
            </div>

            <div className="graph-detail-badges">
              {selectedNode.data.group && <span className="badge badge-group">{selectedNode.data.group}</span>}
              {selectedNode.data.difficulty && (
                <span className="badge" style={{ background: DIFF_COLORS[selectedNode.data.difficulty]?.bg, color: DIFF_COLORS[selectedNode.data.difficulty]?.text }}>
                  {selectedNode.data.difficulty}
                </span>
              )}
              <span className="badge badge-env">{selectedNode.data.status}</span>
            </div>

            <div className="graph-detail-info">
              {selectedNode.data.responsible && <div className="graph-detail-row"><User size={13} /> <span>{selectedNode.data.responsible}</span></div>}
              {selectedNode.data.period && <div className="graph-detail-row"><Clock size={13} /> <span>{selectedNode.data.period}</span></div>}
              {selectedNode.data.estimatedDuration && <div className="graph-detail-row"><Clock size={13} /> <span>{selectedNode.data.estimatedDuration}</span></div>}
              {selectedNode.data.stepCount > 0 && <div className="graph-detail-row"><Layers size={13} /> <span>{selectedNode.data.stepCount} adim</span></div>}
            </div>

            {selectedNode.data.environments?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4, textTransform: 'uppercase' }}>Ortamlar</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {selectedNode.data.environments.map((e, i) => <span key={i} className="badge badge-env" style={{ fontSize: 11 }}>{e}</span>)}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4, textTransform: 'uppercase' }}>Bagimliliklar</div>
              <div style={{ fontSize: 13 }}>
                <div style={{ color: '#10b981' }}>{selectedNode.data.outDeps} giden bagimlilik</div>
                <div style={{ color: '#3b82f6' }}>{selectedNode.data.inDeps} gelen bagimlilik</div>
              </div>
            </div>

            <Link to={`/jobs/${selectedNode.id}`} className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center' }}>
              <ArrowRight size={14} /> Detaya Git
            </Link>
          </div>
        )}
      </div>

      {/* Add Dependency Modal */}
      {showAddDep && (
        <div className="modal-overlay" onClick={() => setShowAddDep(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-title">Yeni Bagimlilik Ekle</div>
            <div className="form-row">
              <div className="form-group">
                <label>Kaynak Is (A yapilinca...)</label>
                <select value={newDep.from} onChange={e => setNewDep({ ...newDep, from: e.target.value })}>
                  <option value="">Is Sec</option>
                  {allNodes.map(n => <option key={n.id} value={n.id}>{n.data.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Hedef Is (...B baslar)</label>
                <select value={newDep.to} onChange={e => setNewDep({ ...newDep, to: e.target.value })}>
                  <option value="">Is Sec</option>
                  {allNodes.filter(n => n.id !== newDep.from).map(n => <option key={n.id} value={n.id}>{n.data.label}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Bagimlilik Turu</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {DEP_TYPES.map(t => (
                  <button key={t} type="button"
                    className={`btn btn-sm ${newDep.type === t ? 'btn-primary' : 'btn-secondary'}`}
                    style={newDep.type === t ? { background: EDGE_COLORS[t], borderColor: EDGE_COLORS[t] } : {}}
                    onClick={() => setNewDep({ ...newDep, type: t })}
                  >{t}</button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Aciklama (opsiyonel)</label>
              <input type="text" value={newDep.description} onChange={e => setNewDep({ ...newDep, description: e.target.value })} placeholder="Bu bagimlilik ne anlama geliyor?" />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowAddDep(false)}>Iptal</button>
              <button className="btn btn-primary" onClick={handleAddDep} disabled={!newDep.from || !newDep.to}>Ekle</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
