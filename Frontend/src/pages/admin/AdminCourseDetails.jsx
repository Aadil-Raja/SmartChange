// src/pages/admin/training/AdminCourseDetails.jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAdminTraining } from "../../hooks/useAdminTraining";
import {
  ArrowLeft, Edit, Upload, Plus, FileText, Video,
  Link as LinkIcon, Trash2, Edit3, HelpCircle, Clock,
  CheckCircle, Eye, GripVertical, X, ChevronRight,
} from "lucide-react";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import Alert from "../../components/ui/Alert";
import AdminContentForm from "./AdminContentForm";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import AdminSidebar from "../../components/ui/AdminSidebar";
import * as quizApi from "../../services/quizApi";

const quizInputBase = {
  width: "100%", padding: "10px 14px", borderRadius: "10px",
  border: "1.5px solid #e0d8ce", background: "white",
  fontSize: "14px", color: "#1a1209", outline: "none",
  transition: "border-color 0.15s, box-shadow 0.15s",
};
const qFocusOn  = (e) => { e.target.style.borderColor = "#f7953f"; e.target.style.boxShadow = "0 0 0 3px rgba(245,130,32,0.12)"; };
const qFocusOff = (e) => { e.target.style.borderColor = "#e0d8ce"; e.target.style.boxShadow = "none"; };

const COURSE_EMOJIS = ["📚","🎯","💡","🔬","🛠️","📊","🌐","🧠","⚡","🚀"];
const getEmoji = (id) => COURSE_EMOJIS[(id || 0) % COURSE_EMOJIS.length];

const AdminCourseDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const {
    currentCourse, contentItems, quizzes, loading, error, success,
    fetchCourseDetails, uploadThumbnail, deleteContent, reorderContent,
    clearMessages, setCourseDeadlineWeeks, activateExistingCourse, deactivateExistingCourse,
  } = useAdminTraining();

  const [quizError, setQuizError] = useState(null);
  const [quizSuccess, setQuizSuccess] = useState(null);
  const [showContentForm, setShowContentForm] = useState(false);
  const [editingContent, setEditingContent] = useState(null);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showCreateQuizModal, setShowCreateQuizModal] = useState(false);
  const [showQuizDetailModal, setShowQuizDetailModal] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [quizForm, setQuizForm] = useState({ title: '', description: '', prerequisite_content_ids: [] });
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [deleteQuizConfirm, setDeleteQuizConfirm] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [isReordering, setIsReordering] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(true);
  const hasFetchedCourse = useRef(null);

  // Deadline config state
  const [deadlineInput, setDeadlineInput] = useState('');
  const [savingDeadline, setSavingDeadline] = useState(false);

  const isPublished = Boolean(currentCourse?.is_active);

  const clearQuizMessages = () => { setQuizError(null); setQuizSuccess(null); };

  useEffect(() => {
    if (id && hasFetchedCourse.current !== id) {
      hasFetchedCourse.current = id;
      fetchCourseDetails(id);
    }
    return () => { clearMessages(); clearQuizMessages(); };
  }, [id]);

  // Sync deadline input when course loads
  useEffect(() => {
    if (currentCourse) {
      setDeadlineInput(currentCourse.deadline_weeks != null ? String(currentCourse.deadline_weeks) : '');
    }
  }, [currentCourse?.id]);

  useEffect(() => { console.log('Quizzes updated:', quizzes); }, [quizzes]);

  const [publishingCourse, setPublishingCourse] = useState(false);

  const handleTogglePublish = async () => {
    setPublishingCourse(true);
    if (isPublished) {
      await deactivateExistingCourse(parseInt(id));
    } else {
      await activateExistingCourse(parseInt(id));
    }
    await fetchCourseDetails(id);
    setPublishingCourse(false);
  };

  const handleSaveDeadline = async () => {
    if (deadlineInput !== '') {
      const weeks = parseInt(deadlineInput, 10);
      if (isNaN(weeks) || weeks <= 0) {
        alert('Deadline must be at least 1 week.');
        return;
      }
      if (weeks > 10) {
        alert('Deadline cannot exceed 10 weeks.');
        return;
      }
    }
    setSavingDeadline(true);
    const weeks = deadlineInput === '' ? null : parseInt(deadlineInput, 10);
    await setCourseDeadlineWeeks(parseInt(id), weeks);
    setSavingDeadline(false);
  };

  const handleThumbnailUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) { alert('File size exceeds 100MB limit'); e.target.value = ''; return; }
    setUploadingThumbnail(true);
    const result = await uploadThumbnail(id, file);
    setUploadingThumbnail(false);
    e.target.value = '';
    if (result.success) await fetchCourseDetails(id);
  };

  const handleAddContent = () => { setEditingContent(null); setShowContentForm(true); };
  const handleEditContent = (content) => { setEditingContent(content); setShowContentForm(true); };

  const handleDeleteContent = async () => {
    if (!deleteConfirm) return;
    const result = await deleteContent(deleteConfirm.id, id);
    setDeleteConfirm(null);
    if (result.success) await fetchCourseDetails(id);
  };

  const handleCreateQuiz = () => {
    setSelectedQuiz(null);
    setQuizForm({ title: `${currentCourse.title} - Quiz`, description: '', prerequisite_content_ids: [] });
    setShowCreateQuizModal(true);
  };

  const handleEditQuiz = (quiz) => {
    setSelectedQuiz(quiz);
    setQuizForm({ title: quiz.title, description: quiz.description || '', prerequisite_content_ids: quiz.prerequisite_content_ids || [] });
    setShowCreateQuizModal(true);
  };

  const handleViewQuiz = (quiz) => { setSelectedQuiz(quiz); setShowQuizDetailModal(true); };

  const refreshQuizData = async () => {
    try { await new Promise(r => setTimeout(r, 300)); return await fetchCourseDetails(id); }
    catch { return { success: false }; }
  };

  const submitQuiz = async (e) => {
    e.preventDefault();
    setSubmittingQuiz(true);
    clearQuizMessages();
    try {
      if (selectedQuiz) { await quizApi.updateCourseQuiz(selectedQuiz.id, quizForm); setQuizSuccess('Quiz updated successfully'); }
      else              { await quizApi.createCourseQuiz(id, quizForm);               setQuizSuccess('Quiz created successfully'); }
      setShowCreateQuizModal(false);
      setSelectedQuiz(null);
      await refreshQuizData();
    } catch (err) { setQuizError(err.response?.data?.detail || 'Failed to save quiz'); }
    finally { setSubmittingQuiz(false); }
  };

  const handleDeleteQuiz = async () => {
    if (!deleteQuizConfirm) return;
    clearQuizMessages();
    try {
      await quizApi.deleteCourseQuiz(deleteQuizConfirm.id);
      setQuizSuccess('Quiz deleted successfully');
      setDeleteQuizConfirm(null);
      await refreshQuizData();
    } catch (err) {
      setQuizError(err.response?.data?.message || err.response?.data?.detail || err.message || 'Failed to delete quiz');
      setDeleteQuizConfirm(null);
    }
  };

  const handlePublishQuiz = async (quizId) => {
    clearQuizMessages();
    try { await quizApi.publishCourseQuiz(quizId); setQuizSuccess('Quiz published successfully'); await refreshQuizData(); }
    catch (err) { setQuizError(err.response?.data?.message || err.response?.data?.detail || 'Failed to publish quiz'); }
  };

  const handleDragStart = (e, item, index) => { setDraggedItem({ item, index }); e.dataTransfer.effectAllowed = 'move'; };
  const handleDragOver  = (e, index) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverIndex(index); };
  const handleDragLeave = () => setDragOverIndex(null);

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault(); setDragOverIndex(null);
    if (!draggedItem || draggedItem.index === dropIndex) { setDraggedItem(null); return; }
    setIsReordering(true);
    try {
      const newItems = [...contentItems];
      const [moved] = newItems.splice(draggedItem.index, 1);
      newItems.splice(dropIndex, 0, moved);
      await reorderContent(id, newItems.map((item, i) => ({ id: item.id, order_index: i })));
    } catch { setQuizError('Failed to reorder content items'); }
    finally { setIsReordering(false); setDraggedItem(null); }
  };

  const getContentIcon = (type) => {
    switch (type) {
      case 'document': return <FileText size={18} className="text-[#00ADEF]" />;
      case 'video':    return <Video    size={18} className="text-[#f7953f]" />;
      case 'link':     return <LinkIcon size={18} className="text-[#78BE20]" />;
      default:         return <FileText size={18} className="text-gray-400"  />;
    }
  };

  const fmt = (d) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  // ── Loading / error states ──
  if (loading && !currentCourse) {
    return (
      <div className="flex h-screen overflow-hidden" style={{ background: '#faf6ef' }}>
        <AdminSidebar collapsed={navCollapsed} onToggle={() => setNavCollapsed(!navCollapsed)} />
        <div className="flex-1 flex items-center justify-center"><LoadingSpinner size="large" /></div>
      </div>
    );
  }
  if (!currentCourse) {
    return (
      <div className="flex h-screen overflow-hidden" style={{ background: '#faf6ef' }}>
        <AdminSidebar collapsed={navCollapsed} onToggle={() => setNavCollapsed(!navCollapsed)} />
        <div className="flex-1 flex items-center justify-center px-8"><Alert variant="error">Course not found</Alert></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#faf6ef' }}>
      <AdminSidebar collapsed={navCollapsed} onToggle={() => setNavCollapsed(!navCollapsed)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ── Breadcrumb top bar ── */}
        <div className="bg-white flex-shrink-0" style={{ borderBottom: '1px solid #e8e0d4' }}>
          <div className="px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm">
              <button
                onClick={() => navigate('/admin/training')}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full border font-medium transition-all"
                style={{ borderColor: '#e0d8ce', color: '#6b5e4e', background: 'white' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#f7953f'; e.currentTarget.style.color = '#f7953f'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0d8ce'; e.currentTarget.style.color = '#6b5e4e'; }}
              >
                <ArrowLeft size={13} /> Courses
              </button>
              <ChevronRight size={14} style={{ color: '#c4b8a8' }} />
              <span className="font-semibold truncate max-w-xs" style={{ color: '#1a1209' }}>{currentCourse.title}</span>
            </div>
            <div className="flex items-center gap-2">
              {!isPublished && (
                <button
                  onClick={() => navigate(`/admin/training/edit/${id}`)}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold border transition-all"
                  style={{ borderColor: '#e0d8ce', color: '#3d3228', background: 'white' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f7953f'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = '#f7953f'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#3d3228'; e.currentTarget.style.borderColor = '#e0d8ce'; }}
                >
                  <Edit size={13} /> Edit
                </button>
              )}
              <span className="px-4 py-1.5 rounded-full text-xs font-semibold"
                style={isPublished
                  ? { background: '#e6f4f1', color: '#0d9488', border: '1px solid #99e6da' }
                  : { background: '#fff4e8', color: '#b45309', border: '1px solid #fcd9b8' }}>
                {isPublished ? '● Published' : '● Draft'}
              </span>
            </div>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-auto">
          <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

            {success && <Alert variant="success" onClose={clearMessages}>{success}</Alert>}
            {error   && <Alert variant="error"   onClose={clearMessages}>{error}</Alert>}

            {/* Publish / Draft banner */}
            <div className="flex items-center justify-between px-5 py-3 rounded-2xl border"
              style={isPublished
                ? { background: '#f0fdf4', borderColor: '#bbf7d0' }
                : { background: '#fff9f0', borderColor: '#fde68a' }}>
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-semibold" style={{ color: isPublished ? '#15803d' : '#92400e' }}>
                  {isPublished ? '✓ Published — visible to employees' : '✎ Draft — not visible to employees'}
                </span>
                {isPublished && <span className="text-xs" style={{ color: '#6b7280' }}>Unpublish to edit content, quizzes, or deadline</span>}
              </div>
              <button
                onClick={handleTogglePublish}
                disabled={publishingCourse}
                className="px-4 py-1.5 rounded-full text-xs font-semibold border transition-all disabled:opacity-50"
                style={isPublished
                  ? { background: 'white', color: '#b45309', borderColor: '#fcd9b8' }
                  : { background: '#15803d', color: 'white', borderColor: '#15803d' }}
                onMouseEnter={e => { if (!publishingCourse) e.currentTarget.style.opacity = '0.85'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
              >
                {publishingCourse ? '…' : isPublished ? 'Unpublish' : 'Publish'}
              </button>
            </div>

            {/* Hero card */}
            <div className="bg-white rounded-[24px] overflow-hidden border border-gray-100" style={{ boxShadow: '0 4px 24px rgba(26,18,9,0.08)' }}>
              <div className="relative h-52 flex items-center justify-center overflow-hidden" style={{ background: '#1a1209' }}>
                <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full border-2 opacity-10" style={{ borderColor: '#faf6ef' }} />
                <div className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full border-2 opacity-10" style={{ borderColor: '#faf6ef' }} />
                <div className="absolute top-8 right-24 w-20 h-20 rounded-full border opacity-10" style={{ borderColor: '#f7953f' }} />
                {currentCourse.thumbnail_url
                  ? <img src={currentCourse.thumbnail_url} alt={currentCourse.title} className="w-full h-full object-cover absolute inset-0" />
                  : <span className="text-7xl select-none z-10">{getEmoji(currentCourse.id)}</span>}
                <label htmlFor="thumbnail-upload"
                  className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full cursor-pointer transition-all z-20"
                  style={{ background: 'rgba(250,246,239,0.12)', color: 'rgba(250,246,239,0.6)', fontSize: '11px' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(250,246,239,0.22)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(250,246,239,0.12)'}>
                  <Upload size={11} />{uploadingThumbnail ? 'Uploading…' : 'Upload Cover'}
                </label>
                <input type="file" id="thumbnail-upload" className="hidden" accept="image/*" onChange={handleThumbnailUpload} disabled={uploadingThumbnail} />
              </div>
              <div className="px-8 py-6">
                <h1 className="text-3xl font-extrabold mb-4 leading-tight" style={{ color: '#1a1209', fontFamily: 'Georgia, serif' }}>{currentCourse.title}</h1>
                <div className="flex flex-wrap gap-2 mb-3">
                  <StatChip icon={<HelpCircle size={14} />} value={quizzes.length}                                    label="Quizzes"       tint="teal"    />
                  <StatChip icon={<FileText   size={14} />} value={contentItems.length}                               label="Content Items" tint="orange"  />
                  <StatChip icon={<Video      size={14} />} value={contentItems.filter(i=>i.type==='video').length}   label="Videos"        tint="neutral" />
                  <StatChip icon={<LinkIcon   size={14} />} value={contentItems.filter(i=>i.type==='link').length}    label="Links"         tint="neutral" />
                </div>
                <p className="text-xs text-gray-400">Created {fmt(currentCourse.created_at)}</p>
              </div>
            </div>

            {/* Course Configuration */}
            <SectionCard title="Course Configuration" subtitle="Set completion deadline for enrolled employees">
              <div className="flex items-end gap-4">
                <div className="flex-1 max-w-xs">
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6b5e4e' }}>
                    Completion Deadline (weeks)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="10"
                      placeholder="No deadline"
                      value={deadlineInput}
                      onChange={e => setDeadlineInput(e.target.value)}
                      disabled={isPublished}
                      className="w-full px-3 py-2 rounded-xl border text-sm outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ borderColor: '#e0d8ce', background: 'white', color: '#1a1209' }}
                      onFocus={e => { e.target.style.borderColor = '#f7953f'; e.target.style.boxShadow = '0 0 0 3px rgba(247,149,63,0.12)'; }}
                      onBlur={e => { e.target.style.borderColor = '#e0d8ce'; e.target.style.boxShadow = 'none'; }}
                    />
                  </div>
                  <p className="text-xs mt-1.5" style={{ color: '#a89880' }}>
                    {deadlineInput
                      ? `Employees must complete within ${deadlineInput} week${deadlineInput === '1' ? '' : 's'} of enrollment`
                      : 'Leave empty to remove the deadline'}
                  </p>
                </div>
                <div className="flex gap-2 pb-6">
                  <PillBtn
                    primary
                    disabled={savingDeadline || isPublished}
                    onClick={handleSaveDeadline}
                  >
                    <Clock size={13} /> {savingDeadline ? 'Saving…' : 'Save'}
                  </PillBtn>
                  {currentCourse.deadline_weeks && (
                    <PillBtn
                      disabled={savingDeadline || isPublished}
                      onClick={() => { setDeadlineInput(''); }}
                    >
                      Clear
                    </PillBtn>
                  )}
                </div>
              </div>
              {currentCourse.deadline_weeks && (
                <div className="mt-1 flex items-center gap-2 px-3 py-2 rounded-xl w-fit" style={{ background: '#fff0e8', border: '1px solid #fdd5b0' }}>
                  <Clock size={13} style={{ color: '#E0741C' }} />
                  <span className="text-xs font-semibold" style={{ color: '#E0741C' }}>
                    Current: {currentCourse.deadline_weeks} week{currentCourse.deadline_weeks !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </SectionCard>

            {/* Content section */}
            <SectionCard title="Course Content" subtitle={isReordering ? 'Reordering…' : 'Drag items to reorder'}
              actions={<>
                <PillBtn onClick={() => navigate('/admin/training/library')} disabled={isReordering}><FileText size={13} /> Library</PillBtn>
                <PillBtn primary onClick={handleAddContent} disabled={isReordering || isPublished}><Plus size={13} /> Add Content</PillBtn>
              </>}>
              {quizSuccess && <Alert variant="success" className="mb-4" onClose={clearQuizMessages}>{quizSuccess}</Alert>}
              {quizError   && <Alert variant="error"   className="mb-4" onClose={clearQuizMessages}>{quizError}</Alert>}
              {isReordering && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-3" style={{ background: '#e8f4fd', border: '1px solid #bfdbfe' }}>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
                  <p className="text-sm text-blue-700">Reordering…</p>
                </div>
              )}
              {contentItems.length === 0
                ? <EmptyState icon={<FileText size={40} className="text-[#f7953f]" />} title="No content yet" sub="Add lessons, videos, documents, or links">
                    <PillBtn primary onClick={handleAddContent}><Plus size={13} /> Add First Content</PillBtn>
                  </EmptyState>
                : <div className="space-y-2">
                    {contentItems.map((item, index) => (
                      <div key={item.id} draggable={!isReordering}
                        onDragStart={e => handleDragStart(e, item, index)} onDragOver={e => handleDragOver(e, index)}
                        onDragLeave={handleDragLeave} onDrop={e => handleDrop(e, index)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all
                          ${dragOverIndex===index ? 'border-[#f7953f] bg-orange-50' : 'border-gray-100 bg-white hover:border-gray-200'}
                          ${isReordering ? 'pointer-events-none opacity-60' : ''}
                          ${draggedItem?.index===index ? 'opacity-40' : ''}`}
                        style={{ boxShadow: '0 1px 4px rgba(26,18,9,0.05)' }}>
                        <GripVertical size={16} className="text-gray-300 cursor-move flex-shrink-0" />
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: '#fff0e8', color: '#E0741C' }}>{index+1}</span>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#f5f0ea' }}>
                          {item.thumbnail_url ? <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover rounded-xl" /> : getContentIcon(item.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-sm font-bold truncate transition-colors"
                            style={{ color: '#1a1209', cursor: (item.type === 'document' || item.access_url) ? 'pointer' : 'default' }}
                            onMouseEnter={e => { if (item.type === 'document' || item.access_url) e.currentTarget.style.color = '#f7953f'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#1a1209'; }}
                            onClick={() => {
                              if (item.access_url) window.open(item.access_url, '_blank');
                            }}
                          >{item.title}</p>
                          {item.description && <p className="text-xs text-gray-400 truncate">{item.description}</p>}
                        </div>
                        <TypeBadge type={item.type} />
                        <div className="flex gap-1 flex-shrink-0">
                          <IconAction onClick={() => handleEditContent(item)} title="Edit" hoverClass="hover:text-[#f7953f] hover:bg-orange-50" disabled={isPublished}><Edit3 size={15} /></IconAction>
                          <IconAction onClick={() => setDeleteConfirm(item)} title="Delete" danger disabled={isPublished}><Trash2 size={15} /></IconAction>
                        </div>
                      </div>
                    ))}
                  </div>}
            </SectionCard>

            {/* Quizzes section */}
            <SectionCard title="Course Quizzes" subtitle="Manage assessments and evaluations"
              actions={<PillBtn primary onClick={handleCreateQuiz} disabled={isPublished}><Plus size={13} /> Create Quiz</PillBtn>}>
              {quizzes.length === 0
                ? <EmptyState icon={<HelpCircle size={40} className="text-[#78BE20]" />} title="No quizzes yet" sub="Create assessments to test student knowledge">
                    <PillBtn primary onClick={handleCreateQuiz}><Plus size={13} /> Create First Quiz</PillBtn>
                  </EmptyState>
                : <div className="space-y-2">
                    {quizzes.map((quiz, index) => (
                      <div key={quiz.id} className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-gray-100 bg-white hover:border-gray-200 transition-all" style={{ boxShadow: '0 1px 4px rgba(26,18,9,0.05)' }}>
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: '#e6f4f1', color: '#0d9488' }}>{index+1}</span>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#e6f4f1' }}><HelpCircle size={18} className="text-teal-600" /></div>
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-sm font-bold truncate transition-colors"
                            style={{ color: '#1a1209', cursor: 'pointer' }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#0d9488'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#1a1209'; }}
                            onClick={() => navigate(`/admin/quiz/${quiz.id}?type=course`)}
                          >{quiz.title}</p>
                          <p className="text-xs text-gray-400">{quiz.total_questions} question{quiz.total_questions!==1?'s':''}{quiz.published_at?` · Published ${fmt(quiz.published_at)}`:''}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${quiz.status==='PUBLISHED'?'bg-green-50 text-green-700 border border-green-200':'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                          {quiz.status?.toLowerCase()||'draft'}
                        </span>
                        <div className="flex gap-1 flex-shrink-0">
                          {quiz.status==='DRAFT' && <IconAction onClick={() => handlePublishQuiz(quiz.id)} title="Publish" hoverClass="hover:text-teal-600 hover:bg-teal-50" disabled={isPublished}><CheckCircle size={15} /></IconAction>}
                          <IconAction onClick={() => handleEditQuiz(quiz)} title="Edit" hoverClass="hover:text-[#f7953f] hover:bg-orange-50" disabled={isPublished}><Edit3 size={15} /></IconAction>
                          <IconAction onClick={() => setDeleteQuizConfirm(quiz)} title={quiz.status==='PUBLISHED'?'Cannot delete a published quiz':'Delete'} danger disabled={quiz.status==='PUBLISHED' || isPublished}><Trash2 size={15} /></IconAction>
                        </div>
                      </div>
                    ))}
                  </div>}
            </SectionCard>
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      {showContentForm && (
        <AdminContentForm courseId={parseInt(id)} editingContent={editingContent}
          onClose={() => { setShowContentForm(false); setEditingContent(null); }}
          onSuccess={() => { setShowContentForm(false); setEditingContent(null); fetchCourseDetails(id); }} />
      )}

      {deleteConfirm && (
        <ConfirmDialog title="Delete Content" message={`Delete "${deleteConfirm.title}"? This cannot be undone.`}
          confirmText="Delete" cancelText="Cancel" variant="danger"
          onConfirm={handleDeleteContent} onCancel={() => setDeleteConfirm(null)} />
      )}

      {deleteQuizConfirm && (
        <ConfirmDialog title="Delete Quiz" message={`Delete "${deleteQuizConfirm.title}"? This cannot be undone.`}
          confirmText="Delete Quiz" cancelText="Cancel" variant="danger"
          onConfirm={handleDeleteQuiz} onCancel={() => setDeleteQuizConfirm(null)} />
      )}

      {/* Create / Edit Quiz modal */}
      {showCreateQuizModal && (
        <CustomModal onClose={() => { setShowCreateQuizModal(false); setSelectedQuiz(null); }}
          title={selectedQuiz ? 'Edit Quiz' : 'Create New Quiz'}>
          <form onSubmit={submitQuiz} className="px-7 py-6 space-y-5">
            <ModalField label="Quiz Title" required>
              <input name="title" value={quizForm.title} onChange={e => setQuizForm({...quizForm, title: e.target.value})}
                placeholder="e.g., Module 1 Assessment" required disabled={submittingQuiz}
                style={quizInputBase} onFocus={qFocusOn} onBlur={qFocusOff} />
            </ModalField>
            <ModalField label="Description" hint="Optional">
              <textarea name="description" value={quizForm.description} onChange={e => setQuizForm({...quizForm, description: e.target.value})}
                placeholder="Briefly describe what this quiz covers…" rows={3} disabled={submittingQuiz}
                style={{ ...quizInputBase, resize: 'vertical', minHeight: '90px' }} onFocus={qFocusOn} onBlur={qFocusOff} />
            </ModalField>
            {selectedQuiz && (
              <ModalField label="Prerequisites" hint="Optional">
                <p className="text-xs mb-2" style={{ color: '#9c8e80' }}>Content items that must be completed before this quiz unlocks</p>
                <div className="max-h-44 overflow-y-auto rounded-xl p-2 space-y-1" style={{ border: '1.5px solid #e0d8ce', background: '#faf6ef' }}>
                  {contentItems.length === 0
                    ? <p className="text-sm italic px-2 py-1" style={{ color: '#9c8e80' }}>No content items available</p>
                    : contentItems.map(item => {
                        const checked = quizForm.prerequisite_content_ids.includes(item.id);
                        return (
                          <label key={item.id} className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all"
                            style={{ background: checked ? '#fff0e8' : 'white', border: `1px solid ${checked ? '#fcd9b8' : 'transparent'}` }}>
                            <input type="checkbox" checked={checked} disabled={submittingQuiz} style={{ accentColor: '#f7953f' }}
                              onChange={e => {
                                const p = e.target.checked
                                  ? [...quizForm.prerequisite_content_ids, item.id]
                                  : quizForm.prerequisite_content_ids.filter(pid => pid !== item.id);
                                setQuizForm({...quizForm, prerequisite_content_ids: p});
                              }} />
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#f3ede4' }}>
                              {item.thumbnail_url ? <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover rounded-lg" /> : getContentIcon(item.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate" style={{ color: '#1a1209' }}>{item.title}</p>
                              <p className="text-xs capitalize" style={{ color: '#9c8e80' }}>{item.type}</p>
                            </div>
                          </label>
                        );
                      })}
                </div>
                {quizForm.prerequisite_content_ids.length > 0 && (
                  <p className="text-xs mt-1.5" style={{ color: '#9c6a3a' }}>{quizForm.prerequisite_content_ids.length} item{quizForm.prerequisite_content_ids.length!==1?'s':''} selected</p>
                )}
              </ModalField>
            )}
            <ModalFooter>
              <ModalCancelBtn onClick={() => { setShowCreateQuizModal(false); setSelectedQuiz(null); }} disabled={submittingQuiz}>Cancel</ModalCancelBtn>
              <ModalSubmitBtn disabled={submittingQuiz}>{submittingQuiz ? 'Saving…' : selectedQuiz ? 'Update Quiz' : 'Create Quiz'}</ModalSubmitBtn>
            </ModalFooter>
          </form>
        </CustomModal>
      )}

      {/* Quiz Detail modal */}
      {showQuizDetailModal && selectedQuiz && (
        <CustomModal onClose={() => { setShowQuizDetailModal(false); setSelectedQuiz(null); }} title={selectedQuiz.title}>
          <div className="px-7 py-6 space-y-5">
            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-4 p-5 rounded-2xl" style={{ background: '#faf6ef', border: '1px solid #ede8e0' }}>
              <div>
                <p className="text-xs font-medium mb-1.5" style={{ color: '#9c8e80' }}>Status</p>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${selectedQuiz.status==='PUBLISHED'?'bg-green-50 text-green-700 border border-green-200':'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                  {selectedQuiz.status==='PUBLISHED' ? <CheckCircle size={11} /> : <Clock size={11} />}
                  {selectedQuiz.status || 'Draft'}
                </span>
              </div>
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: '#9c8e80' }}>Questions</p>
                <p className="text-sm font-bold" style={{ color: '#1a1209' }}>{selectedQuiz.total_questions || 0}</p>
              </div>
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: '#9c8e80' }}>Prerequisites</p>
                <p className="text-sm font-bold" style={{ color: '#1a1209' }}>{selectedQuiz.prerequisite_content_ids?.length || 0} item{(selectedQuiz.prerequisite_content_ids?.length||0)!==1?'s':''}</p>
              </div>
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: '#9c8e80' }}>Created</p>
                <p className="text-sm font-bold" style={{ color: '#1a1209' }}>{fmt(selectedQuiz.created_at)}</p>
              </div>
              {selectedQuiz.published_at && (
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: '#9c8e80' }}>Published</p>
                  <p className="text-sm font-bold" style={{ color: '#1a1209' }}>{fmt(selectedQuiz.published_at)}</p>
                </div>
              )}
              {selectedQuiz.description && (
                <div className="col-span-2">
                  <p className="text-xs font-medium mb-1" style={{ color: '#9c8e80' }}>Description</p>
                  <p className="text-sm" style={{ color: '#3d3228' }}>{selectedQuiz.description}</p>
                </div>
              )}
            </div>

            {/* Prerequisites list */}
            {selectedQuiz.prerequisite_content_ids?.length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: '#9c8e80' }}>PREREQUISITE CONTENT</p>
                <div className="space-y-2">
                  {selectedQuiz.prerequisite_content_ids.map(prereqId => {
                    const ci = contentItems.find(i => i.id === prereqId);
                    if (!ci) return null;
                    return (
                      <div key={prereqId} className="flex items-center gap-3 px-3 py-2 rounded-xl" style={{ background: '#fff0e8', border: '1px solid #fcd9b8' }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#f5f0ea' }}>
                          {ci.thumbnail_url ? <img src={ci.thumbnail_url} alt="" className="w-full h-full object-cover rounded-lg" /> : getContentIcon(ci.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: '#1a1209' }}>{ci.title}</p>
                          <p className="text-xs capitalize" style={{ color: '#9c8e80' }}>{ci.type}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Manage questions hint */}
            <AddQuestionsPanel courseId={parseInt(id)} quizId={selectedQuiz.id} quizStatus={selectedQuiz.status}
              onAdded={async () => { await refreshQuizData(); setSelectedQuiz(prev => ({ ...prev })); }} />
          </div>
        </CustomModal>
      )}
    </div>
  );
};

// ── Reusable primitives ────────────────────────────────────────────────────────

const CustomModal = ({ onClose, title, children }) => (
  <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(26,18,9,0.55)', backdropFilter: 'blur(2px)' }}>
    <div className="bg-white w-full overflow-y-auto" style={{ maxWidth: '520px', maxHeight: '90vh', borderRadius: '20px', boxShadow: '0 24px 64px rgba(26,18,9,0.22)' }}>
      <div className="flex items-center justify-between px-7 pt-6 pb-5" style={{ borderBottom: '1px solid #f0ebe3' }}>
        <h2 className="text-xl font-extrabold" style={{ color: '#1a1209', fontFamily: 'Georgia, serif' }}>{title}</h2>
        <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
          style={{ background: '#f3ede4', color: '#6b5e4e' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#fee2c8'; e.currentTarget.style.color = '#f7953f'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#f3ede4'; e.currentTarget.style.color = '#6b5e4e'; }}>
          <X size={16} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const ModalField = ({ label, hint, required, children }) => (
  <div>
    <label className="block text-sm font-semibold mb-1.5" style={{ color: '#3d3228' }}>
      {label}{required && <span className="text-[#f7953f] ml-0.5">*</span>}
      {hint && <span className="ml-2 text-xs font-normal" style={{ color: '#9c8e80' }}>{hint}</span>}
    </label>
    {children}
  </div>
);

const ModalFooter = ({ children }) => (
  <div className="flex justify-end gap-3" style={{ borderTop: '1px solid #f0ebe3', paddingTop: '20px' }}>{children}</div>
);

const ModalCancelBtn = ({ onClick, disabled, children }) => (
  <button type="button" onClick={onClick} disabled={disabled}
    className="px-5 py-2.5 rounded-full text-sm font-semibold border transition-all disabled:opacity-50"
    style={{ borderColor: '#d0c8be', color: '#6b5e4e', background: 'white' }}
    onMouseEnter={e => e.currentTarget.style.borderColor = '#f7953f'}
    onMouseLeave={e => e.currentTarget.style.borderColor = '#d0c8be'}>
    {children}
  </button>
);

const ModalSubmitBtn = ({ disabled, children }) => (
  <button type="submit" disabled={disabled}
    className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold text-white transition-all disabled:opacity-60"
    style={{ background: '#f7953f' }}
    onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = '#d96e10'; }}
    onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = '#f7953f'; }}>
    {children}
  </button>
);

const StatChip = ({ icon, value, label, tint }) => {
  const s = { teal: { background: '#e6f4f1', color: '#0d9488' }, orange: { background: '#fff0e8', color: '#E0741C' }, neutral: { background: '#f3ede4', color: '#78716c' } };
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm" style={s[tint]||s.neutral}>
      {icon}<span className="font-bold">{value}</span><span className="font-normal opacity-75">{label}</span>
    </div>
  );
};

const SectionCard = ({ title, subtitle, actions, children }) => (
  <div className="bg-white rounded-[20px] overflow-hidden border border-gray-100" style={{ boxShadow: '0 2px 12px rgba(26,18,9,0.06)' }}>
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4" style={{ background: '#faf6ef', borderBottom: '1px solid #ede8e0' }}>
      <div>
        <h2 className="text-lg font-bold" style={{ color: '#1a1209' }}>{title}</h2>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex gap-2">{actions}</div>
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const PillBtn = ({ children, primary, onClick, disabled }) => (
  <button onClick={onClick} disabled={disabled}
    className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    style={primary ? { background: '#1a1209', color: '#faf6ef' } : { background: 'white', color: '#4b4540', border: '1px solid #e0d8ce' }}
    onMouseEnter={e => { if (!disabled && primary) e.currentTarget.style.background = '#f7953f'; }}
    onMouseLeave={e => { if (!disabled && primary) e.currentTarget.style.background = '#1a1209'; }}>
    {children}
  </button>
);

const TypeBadge = ({ type }) => {
  const m = {
    document: { label: 'Document', style: { background: '#fff0e8', color: '#E0741C', border: '1px solid #fcd9b8' } },
    video:    { label: 'Video',    style: { background: '#fef9e7', color: '#b45309', border: '1px solid #fde68a' } },
    link:     { label: 'Link',     style: { background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' } },
  };
  const c = m[type] || { label: type, style: { background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' } };
  return <span className="px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 capitalize" style={c.style}>{c.label}</span>;
};

const IconAction = ({ children, onClick, title, hoverClass, disabled, danger }) => (
  <button onClick={onClick} title={title} disabled={disabled}
    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
      danger
        ? 'text-red-600 hover:bg-[#fff0f0] hover:border hover:border-red-300 border border-transparent'
        : `text-gray-400 ${hoverClass}`
    }`}>
    {children}
  </button>
);

const EmptyState = ({ icon, title, sub, children }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ background: '#f3ede4' }}>{icon}</div>
    <h3 className="text-lg font-bold mb-1" style={{ color: '#1a1209' }}>{title}</h3>
    <p className="text-sm text-gray-400 mb-5 max-w-xs">{sub}</p>
    {children}
  </div>
);

// ── AddQuestionsPanel ─────────────────────────────────────────────────────────
// Shows available document + prompt questions grouped by quiz title.
// Admin checks questions and clicks "Add Selected" to add them as REFERENCED.

const AddQuestionsPanel = ({ courseId, quizId, quizStatus, onAdded }) => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState("DOCUMENT"); // "DOCUMENT" | "PROMPT"
  const [error, setError] = useState(null);

  useEffect(() => {
    if (quizStatus === "PUBLISHED") return;
    setLoading(true);
    quizApi.getAvailableCourseQuestions(courseId)
      .then(res => setQuestions(res.questions || []))
      .catch(() => setError("Failed to load available questions"))
      .finally(() => setLoading(false));
  }, [courseId, quizStatus]);

  const filtered = questions.filter(q => q.source_type === tab);

  // Group by quiz_title
  const grouped = filtered.reduce((acc, q) => {
    const key = q.quiz_title || "Unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(q);
    return acc;
  }, {});

  const toggle = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const handleAdd = async () => {
    if (selected.size === 0) return;
    setAdding(true);
    setError(null);
    try {
      await Promise.all(
        [...selected].map(qId =>
          quizApi.addCourseQuizQuestion(quizId, {
            question_type: "REFERENCED",
            source_document_question_id: qId,
          })
        )
      );
      setSelected(new Set());
      await onAdded();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.detail || "Failed to add questions");
    } finally {
      setAdding(false);
    }
  };

  if (quizStatus === "PUBLISHED") {
    return (
      <div className="px-4 py-3 rounded-xl text-sm" style={{ background: "#f0fdf4", color: "#15803d", border: "1px solid #86efac" }}>
        Quiz is published — questions are locked.
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs font-semibold mb-2" style={{ color: "#9c8e80" }}>ADD QUESTIONS FROM</p>

      {/* Source tab */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {["DOCUMENT", "PROMPT"].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding: "5px 16px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer",
              background: tab === t ? "#1a1209" : "white",
              color: tab === t ? "#faf6ef" : "#9c8e80",
              border: tab === t ? "1.5px solid #1a1209" : "1.5px solid #e0d8ce",
            }}>
            {t === "DOCUMENT" ? "Document Quizzes" : "Prompt Quizzes"}
          </button>
        ))}
      </div>

      {error && <p className="text-xs mb-2" style={{ color: "#dc2626" }}>{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 py-3">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-400" />
          <span className="text-xs" style={{ color: "#9c8e80" }}>Loading questions...</span>
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <p className="text-xs italic py-2" style={{ color: "#9c8e80" }}>
          {tab === "DOCUMENT" ? "No document quiz questions available for this course." : "No prompt quizzes found. Generate one in Quiz Management."}
        </p>
      ) : (
        <div className="max-h-56 overflow-y-auto rounded-xl space-y-3 pr-1" style={{ border: "1.5px solid #e0d8ce", padding: "10px" }}>
          {Object.entries(grouped).map(([quizTitle, qs]) => (
            <div key={quizTitle}>
              <p className="text-xs font-semibold mb-1.5" style={{ color: "#6b5e4e" }}>{quizTitle}</p>
              <div className="space-y-1">
                {qs.map(q => {
                  const checked = selected.has(q.id);
                  return (
                    <label key={q.id} className="flex items-start gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-all"
                      style={{ background: checked ? "#fff0e8" : "#faf6ef", border: `1px solid ${checked ? "#fcd9b8" : "transparent"}` }}>
                      <input type="checkbox" checked={checked} onChange={() => toggle(q.id)}
                        style={{ accentColor: "#f7953f", marginTop: 2, flexShrink: 0 }} />
                      <span className="text-xs" style={{ color: "#1a1209", lineHeight: 1.5 }}>{q.question_text}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected.size > 0 && (
        <button onClick={handleAdd} disabled={adding}
          className="mt-3 flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold text-white transition-all disabled:opacity-60"
          style={{ background: "#f7953f" }}>
          {adding ? "Adding..." : `Add ${selected.size} Question${selected.size > 1 ? "s" : ""}`}
        </button>
      )}
    </div>
  );
};

export default AdminCourseDetails;
