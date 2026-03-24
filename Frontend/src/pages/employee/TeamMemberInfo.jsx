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
		<div className="flex h-screen bg-gray-50 overflow-hidden">
			<EmployeeSidebar
				collapsed={navCollapsed}
				onToggle={() => setNavCollapsed(!navCollapsed)}
			/>

			<div className="flex-1 overflow-auto">
				<div className="bg-gradient-to-br from-[#f7953f] to-[#E0741C] border-b border-orange-300">
					<div className="max-w-7xl mx-auto px-6 py-8">
						<div className="mb-6">
							<button
								onClick={() => navigate(-1)}
								className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white bg-white/15 hover:bg-white/25 transition-colors"
							>
								<ArrowLeft size={16} />
								Back
							</button>
						</div>

						<div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
							<div className="flex items-center gap-6">
								<div className="relative">
									<div className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border-4 border-white/30 shadow-lg overflow-hidden">
										{member?.user_profile_picture ? (
											<img
												src={member.user_profile_picture}
												alt={member?.user_name || 'Member'}
												className="w-full h-full object-cover"
											/>
										) : (
											<User size={48} className="text-white" />
										)}
									</div>

									<div className="absolute -bottom-2 -right-2 bg-[#78BE20] rounded-full p-2 border-4 border-white shadow-lg">
										<Sparkles size={16} className="text-white" />
									</div>
								</div>

								<div className="text-white">
									<h1 className="text-3xl font-bold mb-2">{member?.user_name || member?.user_email || 'Team Member'}</h1>
									<div className="flex flex-wrap items-center gap-3 mb-2">
										<div className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-white/20 text-white">
											{member?.role_in_team === 'manager' ? <Crown size={12} /> : <UserCheck size={12} />}
											<span>{member?.role_in_team === 'manager' ? 'Manager' : 'Member'}</span>
										</div>
										{stateTeam?.team_name && (
											<div className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-white/20 text-white">
												<Trophy size={12} />
												<span>{stateTeam.team_name}</span>
											</div>
										)}
									</div>
									<div className="flex items-center gap-2 text-orange-100 text-sm">
										<Mail size={14} />
										<span>{member?.user_email || 'No email available'}</span>
									</div>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-3 w-full lg:w-auto">
								<Card className="bg-white/10 backdrop-blur-sm border-white/20 p-4 text-center min-w-[140px]">
									<div className="text-2xl font-bold text-white">{safeProgress.toFixed(2)}%</div>
									<div className="text-xs text-orange-100">Overall Progress</div>
								</Card>
								<Card className="bg-white/10 backdrop-blur-sm border-white/20 p-4 text-center min-w-[140px]">
									<div className="text-2xl font-bold text-white">{stats.total_items_completed || 0}</div>
									<div className="text-xs text-orange-100">Items Completed</div>
								</Card>
							</div>
						</div>
					</div>
				</div>

				<div className="max-w-7xl mx-auto px-6 py-8">
					{loading ? (
						<Card className="p-10 text-center border border-gray-200">
							<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f7953f] mx-auto mb-4"></div>
							<p className="text-gray-600">Loading member analytics...</p>
						</Card>
					) : error ? (
						<Card className="p-8 text-center border-red-200 bg-red-50">
							<AlertCircle size={36} className="text-red-500 mx-auto mb-3" />
							<p className="text-red-800 font-semibold mb-4">{error}</p>
							<button
								onClick={fetchMemberData}
								className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
							>
								<RefreshCw size={16} />
								Retry
							</button>
						</Card>
					) : (
						<>
							<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6 mb-8">
								<Card className="p-5 text-center border border-gray-200 hover:shadow-lg transition-all">
									<BookOpen size={22} className="text-[#00ADEF] mx-auto mb-2" />
									<div className="text-2xl font-bold text-[#333333]">{stats.total_enrolled || 0}</div>
									<div className="text-xs text-gray-600">Enrolled</div>
								</Card>

								<Card className="p-5 text-center border border-gray-200 hover:shadow-lg transition-all">
									<Clock size={22} className="text-[#FDB913] mx-auto mb-2" />
									<div className="text-2xl font-bold text-[#333333]">{stats.total_in_progress || 0}</div>
									<div className="text-xs text-gray-600">In Progress</div>
								</Card>

								<Card className="p-5 text-center border border-gray-200 hover:shadow-lg transition-all">
									<CheckCircle size={22} className="text-[#78BE20] mx-auto mb-2" />
									<div className="text-2xl font-bold text-[#333333]">{stats.total_completed || 0}</div>
									<div className="text-xs text-gray-600">Completed</div>
								</Card>

								<Card className="p-5 text-center border border-gray-200 hover:shadow-lg transition-all">
									<Calendar size={22} className="text-red-500 mx-auto mb-2" />
									<div className="text-2xl font-bold text-[#333333]">{stats.total_expired || 0}</div>
									<div className="text-xs text-gray-600">Expired</div>
								</Card>

								<Card className="p-5 text-center border border-gray-200 hover:shadow-lg transition-all">
									<Award size={22} className="text-[#f7953f] mx-auto mb-2" />
									<div className="text-2xl font-bold text-[#333333]">{stats.total_quizzes_completed || 0}/{stats.total_quizzes || 0}</div>
									<div className="text-xs text-gray-600">Quizzes Done</div>
								</Card>
							</div>

							<Card className="p-6 mb-8 border border-gray-200">
								<div className="flex items-center justify-between mb-4">
									<h3 className="text-xl font-bold text-[#333333] inline-flex items-center gap-2">
										<TrendingUp size={20} className="text-[#f7953f]" />
										Overall Learning Progress
									</h3>
									<span className="text-2xl font-bold text-[#f7953f]">{safeProgress.toFixed(2)}%</span>
								</div>
								<div className="w-full bg-gray-200 rounded-full h-4 mb-2">
									<div
										className={`bg-gradient-to-r ${getProgressTone(safeProgress)} h-4 rounded-full transition-all duration-500`}
										style={{ width: `${safeProgress}%` }}
									/>
								</div>
								<div className="flex flex-wrap justify-between gap-2 text-sm text-gray-600">
									<span>{stats.total_items_completed || 0} of {stats.total_items || 0} items completed</span>
									<span>{stats.total_courses_started || 0} courses started</span>
								</div>
							</Card>

							<Card className="border border-gray-200">
								<div className="p-6 border-b border-gray-200">
									<h3 className="text-2xl font-bold text-[#333333] mb-4">Course Activity</h3>

									<div className="flex flex-wrap gap-2">
										<button
											onClick={() => setActiveTab('in_progress')}
											className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
												activeTab === 'in_progress'
													? 'bg-[#f7953f] text-white shadow-md'
													: 'text-gray-600 hover:text-[#333333] hover:bg-gray-50'
											}`}
										>
											<Clock size={16} />
											<span>In Progress</span>
											<span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
												activeTab === 'in_progress'
													? 'bg-white/20 text-white'
													: 'bg-gray-100 text-gray-600'
											}`}>
												{(memberData?.in_progress || []).length}
											</span>
										</button>

										<button
											onClick={() => setActiveTab('completed')}
											className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
												activeTab === 'completed'
													? 'bg-[#78BE20] text-white shadow-md'
													: 'text-gray-600 hover:text-[#333333] hover:bg-gray-50'
											}`}
										>
											<CheckCircle size={16} />
											<span>Completed</span>
											<span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
												activeTab === 'completed'
													? 'bg-white/20 text-white'
													: 'bg-gray-100 text-gray-600'
											}`}>
												{(memberData?.completed || []).length}
											</span>
										</button>

										<button
											onClick={() => setActiveTab('expired')}
											className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
												activeTab === 'expired'
													? 'bg-red-500 text-white shadow-md'
													: 'text-gray-600 hover:text-[#333333] hover:bg-gray-50'
											}`}
										>
											<Calendar size={16} />
											<span>Expired</span>
											<span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
												activeTab === 'expired'
													? 'bg-white/20 text-white'
													: 'bg-red-100 text-red-600'
											}`}>
												{(memberData?.expired || []).length}
											</span>
										</button>
									</div>
								</div>

								<div className="p-6">
									{getActiveTabCourses.length === 0 ? (
										<div className="text-center py-16">
											<div className="inline-flex p-6 bg-gray-50 rounded-full mb-4">
												{activeTab === 'in_progress' && <Clock size={48} className="text-gray-300" />}
												{activeTab === 'completed' && <CheckCircle size={48} className="text-gray-300" />}
												{activeTab === 'expired' && <Calendar size={48} className="text-gray-300" />}
											</div>
											<h4 className="text-xl font-semibold text-[#333333] mb-2">
												No {activeTab.replace('_', ' ')} courses
											</h4>
											<p className="text-gray-600">
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
													<Card key={course.id} className="border border-gray-200 bg-white p-5">
														<div className="flex items-start justify-between gap-3 mb-4">
															<div className="min-w-0">
																<h4 className="font-bold text-[#333333] truncate">{course.title}</h4>
																{course.description && (
																	<p className="text-sm text-gray-600 mt-1 line-clamp-2">{course.description}</p>
																)}
															</div>
															<span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
																activeTab === 'completed'
																	? 'bg-green-100 text-green-700'
																	: activeTab === 'expired'
																	? 'bg-red-100 text-red-700'
																	: 'bg-blue-100 text-blue-700'
															}`}>
																{getStatusLabel(activeTab)}
															</span>
														</div>

														<div className="space-y-3">
															<div>
																<div className="flex items-center justify-between text-sm mb-1">
																	<span className="text-gray-600 font-medium">Progress</span>
																	<span className="text-gray-700">{courseProgress.toFixed(2)}%</span>
																</div>
																<div className="h-2.5 w-full rounded-full bg-gray-200 overflow-hidden">
																	<div
																		className={`h-full rounded-full bg-gradient-to-r ${getProgressTone(courseProgress)} transition-all duration-500`}
																		style={{ width: `${courseProgress}%` }}
																	/>
																</div>
															</div>

															<div className="grid grid-cols-2 gap-2 text-xs">
																<div className="rounded-md bg-gray-50 p-2 border border-gray-100">
																	<p className="text-gray-500">Learning Items</p>
																	<p className="font-semibold text-[#333333]">{completedItems}/{totalItems}</p>
																</div>
																<div className="rounded-md bg-gray-50 p-2 border border-gray-100">
																	<p className="text-gray-500">Quizzes</p>
																	<p className="font-semibold text-[#333333]">{completedQuizzes}/{totalQuizzes}</p>
																</div>
															</div>

															<div className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1 pt-1">
																{course.enrolled_at && <span>Enrolled: {formatDate(course.enrolled_at)}</span>}
																{course.completed_at && <span>Completed: {formatDate(course.completed_at)}</span>}
																{course.deadline_at && <span>Deadline: {formatDate(course.deadline_at)}</span>}
															</div>
														</div>

														<p className="text-[11px] text-gray-400 mt-4 pt-3 border-t border-gray-100">
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
								<Card className="mt-8 p-6 border border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
									<h4 className="text-lg font-bold text-[#333333] mb-3 inline-flex items-center gap-2">
										<Trophy size={18} className="text-[#78BE20]" />
										Recent Completion Highlights
									</h4>
									<div className="space-y-3">
										{memberData.completed.slice(0, 3).map((course) => (
											<div key={course.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-green-100">
												<div>
													<p className="font-medium text-[#333333]">{course.title}</p>
													<p className="text-sm text-gray-600">Completed on {formatDate(course.completed_at)}</p>
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
