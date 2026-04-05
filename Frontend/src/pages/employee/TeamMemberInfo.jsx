import { useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
	ArrowLeft,
	User,
	BookOpen,
	Clock,
	CheckCircle,
	Calendar,
	TrendingUp,
	Award,
	Crown,
	UserCheck,
	Mail,
	AlertCircle,
	RefreshCw,
	Sparkles,
	Trophy
} from 'lucide-react';
import EmployeeSidebar from '../../components/ui/EmployeeSidebar';
import Card from '../../components/ui/Card';
import { getMemberProgress } from '../../services/teamApi';

const TeamMemberInfo = () => {
	const { teamId, memberId } = useParams();
	const location = useLocation();
	const navigate = useNavigate();

	const [navCollapsed, setNavCollapsed] = useState(true);
	const [activeTab, setActiveTab] = useState('in_progress');
	const [memberData, setMemberData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	const stateTeam = location.state?.team;
	const stateMember = location.state?.member;

	const fetchMemberData = async () => {
		if (!teamId || !memberId) {
			setError('Invalid member route.');
			setLoading(false);
			return;
		}

		setLoading(true);
		setError('');
		try {
			const response = await getMemberProgress(teamId, memberId);
			if (response.success) {
				setMemberData(response.data);
			} else {
				setError(response.message || 'Failed to fetch member progress');
			}
		} catch (err) {
			console.error('Error fetching member progress:', err);
			setError('Failed to fetch member progress');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchMemberData();
	}, [teamId, memberId]);

	const stats = memberData?.stats || {};
	const member = memberData?.member || stateMember || {};
	const safeProgress = Math.max(0, Math.min(100, Number(stats.overall_progress || 0)));

	const getActiveTabCourses = useMemo(() => {
		if (!memberData) return [];

		switch (activeTab) {
			case 'in_progress':
				return memberData.in_progress || [];
			case 'completed':
				return memberData.completed || [];
			case 'expired':
				return memberData.expired || [];
			default:
				return [];
		}
	}, [activeTab, memberData]);

	const formatDate = (dateString) => {
		if (!dateString) return 'N/A';
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	};

	const getProgressTone = (progress) => {
		if (progress >= 80) return 'from-[#78BE20] to-[#6AAD1C]';
		if (progress >= 50) return 'from-[#FDB913] to-[#f7953f]';
		return 'from-[#00ADEF] to-[#0094CE]';
	};

	const getStatusLabel = (tab) => {
		switch (tab) {
			case 'completed':
				return 'Completed';
			case 'expired':
				return 'Expired';
			default:
				return 'In Progress';
		}
	};

	return (
		<div className="flex h-screen bg-[#faf6ef] overflow-hidden">
			<EmployeeSidebar
				collapsed={navCollapsed}
				onToggle={() => setNavCollapsed(!navCollapsed)}
			/>

			<div className="flex-1 overflow-auto">
				<div className="max-w-7xl mx-auto px-5 sm:px-6 py-6 sm:py-8">
					<section
						className="relative overflow-hidden rounded-[28px] p-6 sm:p-8 mb-8 border"
						style={{
							background: 'linear-gradient(135deg, #1a1209 0%, #2a1d11 55%, #3a2817 100%)',
							borderColor: '#2f2317',
							boxShadow: '0 20px 48px rgba(26,18,9,0.28)',
						}}
					>
						<div className="absolute -top-10 -right-10 w-44 h-44 rounded-full" style={{ background: 'rgba(247,149,63,0.12)' }} />
						<div className="absolute -bottom-16 -left-10 w-56 h-56 rounded-full" style={{ background: 'rgba(247,149,63,0.08)' }} />

						<div className="relative mb-5">
							<button
								onClick={() => navigate(-1)}
								className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-semibold transition-all"
								style={{ color: '#f6d5b8', background: 'rgba(255,255,255,0.12)' }}
							>
								<ArrowLeft size={16} />
								Back
							</button>
						</div>

						<div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
							<div className="flex items-center gap-6">
								<div className="relative">
									<div
										className="w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center overflow-hidden border-[3px]"
										style={{ borderColor: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.12)' }}
									>
										{member?.user_profile_picture ? (
											<img
												src={member.user_profile_picture}
												alt={member?.user_name || 'Member'}
												className="w-full h-full object-cover"
											/>
										) : (
											<User size={48} className="text-[#fff8ef]" />
										)}
									</div>

									<div className="absolute -bottom-2 -right-2 rounded-full p-2 border-[3px]" style={{ background: '#78BE20', borderColor: '#fff4e8' }}>
										<Sparkles size={15} className="text-white" />
									</div>
								</div>

								<div>
									<h1 className="text-3xl sm:text-4xl font-bold mb-2" style={{ color: '#fff9ef', fontFamily: 'Georgia, serif' }}>
										{member?.user_name || member?.user_email || 'Team Member'}
									</h1>
									<div className="flex flex-wrap items-center gap-2.5 mb-2.5">
										<div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: 'rgba(255,255,255,0.16)', color: '#f7dcc1' }}>
											{member?.role_in_team === 'manager' ? <Crown size={12} /> : <UserCheck size={12} />}
											<span>{member?.role_in_team === 'manager' ? 'Manager' : 'Member'}</span>
										</div>
										{stateTeam?.team_name && (
											<div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: 'rgba(247,149,63,0.22)', color: '#ffd9b8' }}>
												<Trophy size={12} />
												<span>{stateTeam.team_name}</span>
											</div>
										)}
									</div>
									<div className="flex items-center gap-2 text-sm" style={{ color: '#f6d5b8' }}>
										<Mail size={14} />
										<span>{member?.user_email || 'No email available'}</span>
									</div>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-3 w-full lg:w-auto">
								<div className="rounded-2xl px-5 py-4 border text-center min-w-[148px]" style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.2)' }}>
									<div className="text-2xl font-bold" style={{ color: '#fffaf0' }}>{safeProgress.toFixed(2)}%</div>
									<div className="text-xs uppercase tracking-wide" style={{ color: '#f3d1b1' }}>Overall Progress</div>
								</div>
								<div className="rounded-2xl px-5 py-4 border text-center min-w-[148px]" style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.2)' }}>
									<div className="text-2xl font-bold" style={{ color: '#fffaf0' }}>{stats.total_items_completed || 0}</div>
									<div className="text-xs uppercase tracking-wide" style={{ color: '#f3d1b1' }}>Items Completed</div>
								</div>
							</div>
						</div>
					</section>

					{loading ? (
						<Card className="p-10 text-center border rounded-3xl" style={{ borderColor: '#e8e0d4', boxShadow: '0 8px 22px rgba(26,18,9,0.08)' }}>
							<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f7953f] mx-auto mb-4"></div>
							<p style={{ color: '#6b5e4e' }}>Loading member analytics...</p>
						</Card>
					) : error ? (
						<Card className="p-8 text-center rounded-3xl border" style={{ background: '#fff7f7', borderColor: '#f6caca', boxShadow: '0 8px 24px rgba(220,38,38,0.08)' }}>
							<AlertCircle size={36} className="text-red-500 mx-auto mb-3" />
							<p className="text-red-800 font-semibold mb-4">{error}</p>
							<button
								onClick={fetchMemberData}
								className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-white font-semibold transition-all"
								style={{ background: '#dc2626' }}
							>
								<RefreshCw size={16} />
								Retry
							</button>
						</Card>
					) : (
						<>
							<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 mb-8">
								<Card className="p-5 border rounded-3xl bg-white" style={{ borderColor: '#e8e0d4', boxShadow: '0 6px 16px rgba(26,18,9,0.07)' }}>
									<div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3" style={{ background: '#ecf6fd' }}>
										<BookOpen size={22} className="text-[#0a7cb8]" />
									</div>
									<div className="text-3xl font-bold" style={{ color: '#1a1209' }}>{stats.total_enrolled || 0}</div>
									<div className="text-xs" style={{ color: '#6b5e4e' }}>Enrolled</div>
								</Card>

								<Card className="p-5 border rounded-3xl bg-white" style={{ borderColor: '#e8e0d4', boxShadow: '0 6px 16px rgba(26,18,9,0.07)' }}>
									<div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3" style={{ background: '#fff3e8' }}>
										<Clock size={22} className="text-[#e0741c]" />
									</div>
									<div className="text-3xl font-bold" style={{ color: '#1a1209' }}>{stats.total_in_progress || 0}</div>
									<div className="text-xs" style={{ color: '#6b5e4e' }}>In Progress</div>
								</Card>

								<Card className="p-5 border rounded-3xl bg-white" style={{ borderColor: '#e8e0d4', boxShadow: '0 6px 16px rgba(26,18,9,0.07)' }}>
									<div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3" style={{ background: '#edf8ea' }}>
										<CheckCircle size={22} className="text-[#3f8e1b]" />
									</div>
									<div className="text-3xl font-bold" style={{ color: '#1a1209' }}>{stats.total_completed || 0}</div>
									<div className="text-xs" style={{ color: '#6b5e4e' }}>Completed</div>
								</Card>

								<Card className="p-5 border rounded-3xl bg-white" style={{ borderColor: '#e8e0d4', boxShadow: '0 6px 16px rgba(26,18,9,0.07)' }}>
									<div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3" style={{ background: '#fff1f2' }}>
										<Calendar size={22} className="text-[#dc2626]" />
									</div>
									<div className="text-3xl font-bold" style={{ color: '#1a1209' }}>{stats.total_expired || 0}</div>
									<div className="text-xs" style={{ color: '#6b5e4e' }}>Expired</div>
								</Card>

								<Card className="p-5 border rounded-3xl bg-white" style={{ borderColor: '#e8e0d4', boxShadow: '0 6px 16px rgba(26,18,9,0.07)' }}>
									<div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3" style={{ background: '#fff6e8' }}>
										<Award size={22} className="text-[#f7953f]" />
									</div>
									<div className="text-3xl font-bold" style={{ color: '#1a1209' }}>{stats.total_quizzes_completed || 0}/{stats.total_quizzes || 0}</div>
									<div className="text-xs" style={{ color: '#6b5e4e' }}>Quizzes Done</div>
								</Card>
							</div>

							<Card className="p-6 mb-8 border rounded-3xl bg-white" style={{ borderColor: '#e8e0d4', boxShadow: '0 8px 22px rgba(26,18,9,0.08)' }}>
								<div className="flex items-center justify-between mb-4">
									<h3 className="text-2xl font-bold inline-flex items-center gap-2" style={{ color: '#1a1209', fontFamily: 'Georgia, serif' }}>
										<TrendingUp size={20} className="text-[#f7953f]" />
										Overall Learning Progress
									</h3>
									<span className="text-2xl font-bold text-[#f7953f]">{safeProgress.toFixed(2)}%</span>
								</div>
								<div className="w-full rounded-full h-4 mb-2" style={{ background: '#eee4d7' }}>
									<div
										className={`bg-gradient-to-r ${getProgressTone(safeProgress)} h-4 rounded-full transition-all duration-500`}
										style={{ width: `${safeProgress}%` }}
									/>
								</div>
								<div className="flex flex-wrap justify-between gap-2 text-sm" style={{ color: '#6b5e4e' }}>
									<span>{stats.total_items_completed || 0} of {stats.total_items || 0} items completed</span>
									<span>{stats.total_courses_started || 0} courses started</span>
								</div>
							</Card>

							<Card className="border rounded-3xl bg-white overflow-hidden" style={{ borderColor: '#e8e0d4', boxShadow: '0 10px 24px rgba(26,18,9,0.08)' }}>
								<div className="p-6 border-b" style={{ borderColor: '#ede6dc' }}>
									<h3 className="text-2xl font-bold mb-4" style={{ color: '#1a1209', fontFamily: 'Georgia, serif' }}>Course Activity</h3>

									<div className="flex flex-wrap gap-2">
										<button
											onClick={() => setActiveTab('in_progress')}
											className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all ${
												activeTab === 'in_progress'
													? 'text-white'
													: ''
											}`}
											style={{
												background: activeTab === 'in_progress' ? '#1a1209' : '#f6f1e8',
												color: activeTab === 'in_progress' ? '#ffffff' : '#6b5e4e',
												border: activeTab === 'in_progress' ? '1px solid transparent' : '1px solid #eadfce',
											}}
										>
											<Clock size={16} />
											<span>In Progress</span>
											<span className="ml-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: activeTab === 'in_progress' ? 'rgba(255,255,255,0.2)' : '#ffffff' }}>
												{(memberData?.in_progress || []).length}
											</span>
										</button>

										<button
											onClick={() => setActiveTab('completed')}
											className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all ${
												activeTab === 'completed'
													? 'text-white'
													: ''
											}`}
											style={{
												background: activeTab === 'completed' ? '#3f8e1b' : '#f6f1e8',
												color: activeTab === 'completed' ? '#ffffff' : '#6b5e4e',
												border: activeTab === 'completed' ? '1px solid transparent' : '1px solid #eadfce',
											}}
										>
											<CheckCircle size={16} />
											<span>Completed</span>
											<span className="ml-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: activeTab === 'completed' ? 'rgba(255,255,255,0.2)' : '#ffffff' }}>
												{(memberData?.completed || []).length}
											</span>
										</button>

										<button
											onClick={() => setActiveTab('expired')}
											className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all ${
												activeTab === 'expired'
													? 'text-white'
													: ''
											}`}
											style={{
												background: activeTab === 'expired' ? '#dc2626' : '#fff1f2',
												color: activeTab === 'expired' ? '#ffffff' : '#b91c1c',
												border: activeTab === 'expired' ? '1px solid transparent' : '1px solid #fecdd3',
											}}
										>
											<Calendar size={16} />
											<span>Expired</span>
											<span className="ml-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: activeTab === 'expired' ? 'rgba(255,255,255,0.2)' : '#ffffff' }}>
												{(memberData?.expired || []).length}
											</span>
										</button>
									</div>
								</div>

								<div className="p-6">
									{getActiveTabCourses.length === 0 ? (
										<div className="text-center py-16">
											<div className="inline-flex p-6 rounded-full mb-4" style={{ background: '#f3ede4' }}>
												{activeTab === 'in_progress' && <Clock size={48} style={{ color: '#b1a492' }} />}
												{activeTab === 'completed' && <CheckCircle size={48} style={{ color: '#b1a492' }} />}
												{activeTab === 'expired' && <Calendar size={48} style={{ color: '#b1a492' }} />}
											</div>
											<h4 className="text-xl font-semibold mb-2" style={{ color: '#1a1209' }}>
												No {activeTab.replace('_', ' ')} courses
											</h4>
											<p style={{ color: '#7c6f61' }}>
												{activeTab === 'in_progress' && 'No active learning is in progress right now.'}
												{activeTab === 'completed' && 'This member has not completed any courses yet.'}
												{activeTab === 'expired' && 'No course deadlines have expired.'}
											</p>
										</div>
									) : (
										<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
											{getActiveTabCourses.map((course) => {
												const courseProgress = Math.max(0, Math.min(100, Number(course.progress || 0)));
												const completedItems = course.completed_items || 0;
												const totalItems = course.total_items || 0;
												const completedQuizzes = course.completed_quizzes || 0;
												const totalQuizzes = course.total_quizzes || 0;

												return (
													<Card
														key={course.id}
														className="border bg-white p-5 rounded-3xl"
														style={{ borderColor: '#e8e0d4', boxShadow: '0 8px 20px rgba(26,18,9,0.07)' }}
													>
														<div className="flex items-start justify-between gap-3 mb-4">
															<div className="min-w-0">
																<h4 className="font-bold truncate" style={{ color: '#1a1209' }}>{course.title}</h4>
																{course.description && (
																	<p className="text-sm mt-1 line-clamp-2" style={{ color: '#7c6f61' }}>{course.description}</p>
																)}
															</div>
															<span
																className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
																style={{
																	background: activeTab === 'completed' ? '#e8f5e3' : activeTab === 'expired' ? '#fee2e2' : '#e8f4fd',
																	color: activeTab === 'completed' ? '#3f8e1b' : activeTab === 'expired' ? '#b91c1c' : '#0369a1',
																}}
															>
																{getStatusLabel(activeTab)}
															</span>
														</div>

														<div className="space-y-3">
															<div>
																<div className="flex items-center justify-between text-sm mb-1">
																	<span className="font-medium" style={{ color: '#6b5e4e' }}>Completion</span>
																	<span style={{ color: '#6b5e4e' }}>{courseProgress.toFixed(0)}%</span>
																</div>
																<div className="h-2 w-full rounded-full overflow-hidden" style={{ background: '#efe5d7' }}>
																	<div
																		className={`h-full rounded-full bg-gradient-to-r ${getProgressTone(courseProgress)} transition-all duration-500`}
																		style={{ width: `${courseProgress}%` }}
																	/>
																</div>
															</div>

															{/* Per-quiz scores */}
															{course.quiz_scores && course.quiz_scores.length > 0 && (
																<div className="space-y-1.5">
																	<p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#9c8e80' }}>Quiz Scores</p>
																	{course.quiz_scores.map(q => (
																		<div key={q.quiz_id} className="flex items-center justify-between text-xs rounded-lg px-2.5 py-1.5" style={{ background: '#faf6ef', border: '1px solid #ede3d5' }}>
																			<span className="truncate max-w-[120px]" style={{ color: '#6b5e4e' }}>{q.title}</span>
																			<span className="font-semibold flex-shrink-0 ml-2" style={{ color: q.passed ? '#15803d' : q.attempts_used > 0 ? '#b45309' : '#9c8e80' }}>
																				{q.attempts_used === 0 ? 'Not attempted' : q.passed ? `Passed · ${q.best_score?.toFixed(0)}%` : `Failed · ${q.best_score?.toFixed(0)}%`}
																			</span>
																		</div>
																	))}
																</div>
															)}

															{/* Content items count */}
															<div className="text-xs" style={{ color: '#8b7e6e' }}>
																{completedItems}/{totalItems} content items completed
															</div>

															<div className="text-xs flex flex-wrap gap-x-4 gap-y-1 pt-1" style={{ color: '#8b7e6e' }}>
																{course.enrolled_at && <span>Enrolled: {formatDate(course.enrolled_at)}</span>}
																{course.completed_at && <span>Completed: {formatDate(course.completed_at)}</span>}
																{course.deadline_at && <span>Deadline: {formatDate(course.deadline_at)}</span>}
															</div>
														</div>

														<p className="text-[11px] mt-4 pt-3 border-t" style={{ color: '#a39788', borderColor: '#ede3d5' }}>
															View only: actions are disabled on team member profiles.
														</p>
													</Card>
												);
											})}
										</div>
									)}
								</div>
							</Card>

							{memberData?.completed?.length > 0 && (
								<Card className="mt-8 p-6 border rounded-3xl" style={{ borderColor: '#d6ebc8', background: 'linear-gradient(135deg, #f4fbef 0%, #ecf8e3 100%)' }}>
									<h4 className="text-lg font-bold mb-3 inline-flex items-center gap-2" style={{ color: '#26401b' }}>
										<Trophy size={18} className="text-[#78BE20]" />
										Recent Completion Highlights
									</h4>
									<div className="space-y-3">
										{memberData.completed.slice(0, 3).map((course) => (
											<div key={course.id} className="flex items-center justify-between p-3 bg-white rounded-2xl border" style={{ borderColor: '#d6ebc8' }}>
												<div>
													<p className="font-medium" style={{ color: '#26401b' }}>{course.title}</p>
													<p className="text-sm" style={{ color: '#5f7b4a' }}>Completed on {formatDate(course.completed_at)}</p>
												</div>
												<CheckCircle size={18} className="text-[#78BE20]" />
											</div>
										))}
									</div>
								</Card>
							)}
						</>
					)}
				</div>
			</div>
		</div>
	);
};

export default TeamMemberInfo;
