// Supabase配置
// 注意：实际部署时需要替换为真实的Supabase项目配置
const SUPABASE_URL = 'https://wmycsyvnmilmactjuaki.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_2TmUJB8-MKMhB1q7ADa7nA_yHzaV2oI';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 固定题库
const questionBank = [
  { question: 'sin(π/6)', answer: '1/2' },
  { question: 'sin(π/4)', answer: '√2/2' },
  { question: 'sin(π/3)', answer: '√3/2' },
  { question: 'cos(π/6)', answer: '√3/2' },
  { question: 'cos(π/4)', answer: '√2/2' },
  { question: 'cos(π/3)', answer: '1/2' },
  { question: 'tan(π/6)', answer: '√3/3' },
  { question: 'tan(π/4)', answer: '1' },
  { question: 'tan(π/3)', answer: '√3' }
];

// 所有选项
const allOptions = ['√2/2', '√3/2', '1/2', '√3', '√3/3', '1'];

// 评分规则
const getScore = (time) => {
  if (time <= 16) return 10;
  if (time <= 22) return 9;
  if (time <= 28) return 8;
  if (time <= 34) return 7;
  if (time <= 40) return 6;
  if (time <= 45) return 5;
  return 4;
};

// 防作弊检测
const detectCheating = (gameData) => {
  const { questionTimes, totalTime, clickPositions } = gameData;
  
  // 单题用时过短
  if (questionTimes.some(time => time < 0.3)) {
    return { isCheating: true, reason: '单题用时过短' };
  }
  
  // 总用时过短
  if (totalTime < 5) {
    return { isCheating: true, reason: '总用时过短' };
  }
  
  // 固定位置点击
  if (clickPositions.length === 9 && clickPositions.every(pos => pos === clickPositions[0])) {
    return { isCheating: true, reason: '固定位置点击' };
  }
  
  // 时间过于规整
  const integerTimes = questionTimes.filter(time => Math.abs(time - Math.round(time)) < 0.01);
  if (integerTimes.length === 9) {
    return { isCheating: true, reason: '时间过于规整' };
  }
  
  // 至少7道题耗时相同
  const timeCounts = {};
  questionTimes.forEach(time => {
    const roundedTime = Math.round(time * 100) / 100;
    timeCounts[roundedTime] = (timeCounts[roundedTime] || 0) + 1;
  });
  
  if (Object.values(timeCounts).some(count => count >= 7)) {
    return { isCheating: true, reason: '时间过于规整' };
  }
  
  return { isCheating: false, reason: '' };
};

// 随机打乱数组
const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// 主应用组件
class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      currentPage: 'home',
      nickname: '',
      adminPassword: '',
      questions: [],
      currentQuestionIndex: 0,
      startTime: null,
      currentQuestionStartTime: null,
      questionTimes: [],
      clickPositions: [],
      questionAnswers: [], // 记录每道题的题目和答案
      operations: [], // 记录操作行为
      totalTime: 0,
      score: 0,
      isGameOver: false,
      isCorrect: false,
      errorMessage: '',
      loading: false,
      historicalScores: [],
      leaderboard: [],
      adminRecords: [],
      currentPageAdmin: 1,
      pageSize: 20,
      searchTerm: '',
      sortBy: 'score',
      sortOrder: 'desc',
      cheatFilter: 'all',
      stats: {
        totalRecords: 0,
        cheatRecords: 0,
        averageTime: 0,
        highestScore: 0,
        lowestScore: 0
      }
    };
  }

  // 开始游戏
  startGame = () => {
    if (!this.state.nickname.trim()) {
      this.setState({ errorMessage: '请输入昵称' });
      return;
    }

    const shuffledQuestions = shuffleArray([...questionBank]);
    this.setState({
      currentPage: 'game',
      questions: shuffledQuestions,
      currentQuestionIndex: 0,
      startTime: Date.now(),
      currentQuestionStartTime: Date.now(),
      questionTimes: [],
      clickPositions: [],
      questionAnswers: [], // 重置答题记录
      operations: [], // 重置操作记录
      totalTime: 0,
      score: 0,
      isGameOver: false,
      isCorrect: false,
      errorMessage: ''
    });
  };

  // 分析操作行为
  analyzeOperations = (operations) => {
    let isCheating = false;
    let reason = '';
    
    // 检测纯键盘操作
    const hasMouseEvents = operations.some(op => op.type.includes('mouse'));
    const hasKeyboardEvents = operations.some(op => op.type.includes('key'));
    if (hasKeyboardEvents && !hasMouseEvents) {
      isCheating = true;
      reason = '检测到纯键盘操作模式';
    }
    
    // 检测操作间隔规律
    if (operations.length > 1) {
      const intervals = [];
      for (let i = 1; i < operations.length; i++) {
        intervals.push(operations[i].timestamp - operations[i-1].timestamp);
      }
      
      const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
      const variance = intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / intervals.length;
      
      // 方差过小，说明间隔过于规律
      if (variance < 10) {
        isCheating = true;
        reason = '操作间隔过于规律';
      }
    }
    
    // 检测点击位置是否过于集中
    const positions = operations.map(op => op.target);
    const positionCounts = {};
    positions.forEach(pos => {
      positionCounts[pos] = (positionCounts[pos] || 0) + 1;
    });
    
    // 如果大部分操作都集中在少数几个位置
    const mostFrequent = Math.max(...Object.values(positionCounts));
    if (mostFrequent > operations.length * 0.8) {
      isCheating = true;
      reason = '操作位置过于集中';
    }
    
    return { isCheating, reason };
  };

  // 处理选项点击
  handleOptionClick = (option, index, event) => {
    // 检测事件是否为用户真实操作
    if (event && !event.isTrusted) {
      // 标记为作弊并结束游戏
      this.setState({
        currentPage: 'home',
        errorMessage: '❌ 检测到非用户操作，挑战结束'
      });
      return;
    }

    // 记录操作行为
    const operationData = {
      type: event ? event.type : 'click',
      timestamp: Date.now(),
      target: index,
      key: event ? event.key : null,
      clientX: event ? event.clientX : null,
      clientY: event ? event.clientY : null
    };

    const { questions, currentQuestionIndex, currentQuestionStartTime, questionTimes, clickPositions, questionAnswers, operations } = this.state;
    const currentQuestion = questions[currentQuestionIndex];
    const isCorrect = option === currentQuestion.answer;
    const questionTime = (Date.now() - currentQuestionStartTime) / 1000;

    if (isCorrect) {
      const newQuestionTimes = [...questionTimes, questionTime];
      const newClickPositions = [...clickPositions, index + 1];
      const newQuestionAnswers = [...questionAnswers, {
        question: currentQuestion.question,
        userAnswer: option
      }];
      const newOperations = [...operations, operationData];
      
      if (currentQuestionIndex === questions.length - 1) {
        // 游戏结束，分析操作行为
        const totalTime = (Date.now() - this.state.startTime) / 1000;
        const score = getScore(totalTime);
        
        const gameData = {
          questionTimes: newQuestionTimes,
          totalTime,
          clickPositions: newClickPositions
        };
        
        const cheatingResult = detectCheating(gameData);
        const behaviorAnalysis = this.analyzeOperations(newOperations);
        
        // 综合判断是否作弊
        let finalIsCheating = cheatingResult.isCheating || behaviorAnalysis.isCheating;
        let finalCheatReason = cheatingResult.reason || behaviorAnalysis.reason;
        
        this.setState({
          isGameOver: true,
          totalTime,
          score,
          questionAnswers: newQuestionAnswers,
          operations: newOperations,
          isCheating: finalIsCheating,
          cheatReason: finalCheatReason
        });
      } else {
        // 下一题
        this.setState({
          currentQuestionIndex: currentQuestionIndex + 1,
          currentQuestionStartTime: Date.now(),
          questionTimes: newQuestionTimes,
          clickPositions: newClickPositions,
          questionAnswers: newQuestionAnswers,
          operations: newOperations,
          isCorrect: true
        });
      }
    } else {
      // 错误，游戏结束
      this.setState({
        currentPage: 'home',
        errorMessage: '❌ 错误，挑战结束'
      });
    }
  };

  // 保存成绩
  saveScore = async () => {
    const { nickname, totalTime, score, isCheating, cheatReason, questionAnswers } = this.state;
    
    try {
      this.setState({ loading: true });
      
      // 验证答案正确性
      let allAnswersCorrect = true;
      for (const answer of questionAnswers) {
        const { question, userAnswer } = answer;
        const { data: questionData, error: questionError } = await supabase
          .from('questions')
          .select('answer')
          .eq('question', question)
          .single();
        
        if (questionError || questionData.answer !== userAnswer) {
          allAnswersCorrect = false;
          break;
        }
      }
      
      if (!allAnswersCorrect) {
        // 答案验证失败，标记为作弊
        const { data, error } = await supabase
          .from('scores')
          .insert({
            nickname,
            time: totalTime,
            score,
            is_cheating: true,
            cheat_reason: '答案验证失败'
          });
        
        if (error) {
          // 网络失败，保存到本地
          const offlineScore = {
            nickname,
            time: totalTime,
            score,
            is_cheating: true,
            cheat_reason: '答案验证失败',
            timestamp: new Date().toISOString(),
            offline: true
          };
          
          const offlineScores = JSON.parse(localStorage.getItem('offlineScores') || '[]');
          offlineScores.push(offlineScore);
          localStorage.setItem('offlineScores', JSON.stringify(offlineScores));
          
          alert('网络失败，成绩已保存到本地，稍后可同步');
        } else {
          alert('成绩保存成功，但答案验证失败，已标记为作弊！');
        }
      } else {
        // 答案验证通过，保存正常成绩
        const { data, error } = await supabase
          .from('scores')
          .insert({
            nickname,
            time: totalTime,
            score,
            is_cheating: isCheating,
            cheat_reason: cheatReason
          });
        
        if (error) {
          // 网络失败，保存到本地
          const offlineScore = {
            nickname,
            time: totalTime,
            score,
            is_cheating: isCheating,
            cheat_reason: cheatReason,
            timestamp: new Date().toISOString(),
            offline: true
          };
          
          const offlineScores = JSON.parse(localStorage.getItem('offlineScores') || '[]');
          offlineScores.push(offlineScore);
          localStorage.setItem('offlineScores', JSON.stringify(offlineScores));
          
          alert('网络失败，成绩已保存到本地，稍后可同步');
        } else {
          alert('成绩保存成功！');
        }
      }
      
      this.setState({ loading: false });
    } catch (error) {
      // 保存到本地
      const offlineScore = {
        nickname,
        time: totalTime,
        score,
        is_cheating: true,
        cheat_reason: '验证失败',
        timestamp: new Date().toISOString(),
        offline: true
      };
      
      const offlineScores = JSON.parse(localStorage.getItem('offlineScores') || '[]');
      offlineScores.push(offlineScore);
      localStorage.setItem('offlineScores', JSON.stringify(offlineScores));
      
      alert('网络失败，成绩已保存到本地，稍后可同步');
      this.setState({ loading: false });
    }
  };

  // 同步离线成绩
  syncOfflineScores = async () => {
    try {
      this.setState({ loading: true });
      
      const offlineScores = JSON.parse(localStorage.getItem('offlineScores') || '[]');
      
      if (offlineScores.length === 0) {
        alert('没有离线成绩需要同步');
        this.setState({ loading: false });
        return;
      }
      
      for (const score of offlineScores) {
        const { data, error } = await supabase
          .from('scores')
          .insert({
            nickname: score.nickname,
            time: score.time,
            score: score.score,
            is_cheating: score.is_cheating,
            cheat_reason: score.cheat_reason
          });
        
        if (error) {
          alert('同步失败，请稍后重试');
          this.setState({ loading: false });
          return;
        }
      }
      
      // 清除本地存储的离线成绩
      localStorage.removeItem('offlineScores');
      alert('离线成绩同步成功！');
      this.setState({ loading: false });
    } catch (error) {
      alert('同步失败，请稍后重试');
      this.setState({ loading: false });
    }
  };

  // 获取历史成绩
  getHistoricalScores = async () => {
    try {
      this.setState({ loading: true });
      
      const { nickname } = this.state;
      
      const { data, error } = await supabase
        .from('scores')
        .select('*')
        .eq('nickname', nickname)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('获取历史成绩失败:', error);
        this.setState({ loading: false });
        return;
      }
      
      this.setState({ historicalScores: data, loading: false });
    } catch (error) {
      console.error('获取历史成绩失败:', error);
      this.setState({ loading: false });
    }
  };

  // 获取排行榜
  getLeaderboard = async () => {
    try {
      this.setState({ loading: true });
      
      // 先获取所有成绩
      const { data: allScores, error } = await supabase
        .from('scores')
        .select('*');
      
      if (error) {
        console.error('获取排行榜失败:', error);
        this.setState({ loading: false });
        return;
      }
      
      // 按昵称分组，取每位玩家的最好成绩
      const playerBestScores = {};
      
      allScores.forEach(score => {
        const { nickname, score: currentScore, time: currentTime } = score;
        
        if (!playerBestScores[nickname]) {
          // 该玩家还没有记录，直接添加
          playerBestScores[nickname] = score;
        } else {
          // 比较得分
          const existingScore = playerBestScores[nickname].score;
          const existingTime = playerBestScores[nickname].time;
          
          if (currentScore > existingScore) {
            // 当前得分更高，更新记录
            playerBestScores[nickname] = score;
          } else if (currentScore === existingScore && currentTime < existingTime) {
            // 得分相同，用时更短，更新记录
            playerBestScores[nickname] = score;
          }
        }
      });
      
      // 转换为数组并排序
      const leaderboard = Object.values(playerBestScores)
        .sort((a, b) => {
          // 先按得分降序
          if (b.score !== a.score) {
            return b.score - a.score;
          }
          // 得分相同按用时升序
          return a.time - b.time;
        });
      
      this.setState({ leaderboard, loading: false });
    } catch (error) {
      console.error('获取排行榜失败:', error);
      this.setState({ loading: false });
    }
  };

  // 获取管理后台数据
  getAdminRecords = async () => {
    try {
      this.setState({ loading: true });
      
      let query = supabase
        .from('scores')
        .select('*');
      
      // 应用搜索
      if (this.state.searchTerm) {
        query = query.ilike('nickname', `%${this.state.searchTerm}%`);
      }
      
      // 应用作弊筛选
      if (this.state.cheatFilter === 'cheat') {
        query = query.eq('is_cheating', true);
      } else if (this.state.cheatFilter === 'normal') {
        query = query.eq('is_cheating', false);
      }
      
      // 应用排序
      query = query.order(this.state.sortBy, { 
        ascending: this.state.sortOrder === 'asc' 
      });
      
      // 应用分页
      query = query
        .range(
          (this.state.currentPageAdmin - 1) * this.state.pageSize,
          this.state.currentPageAdmin * this.state.pageSize - 1
        );
      
      const { data, error, count } = await query;
      
      if (error) {
        console.error('获取管理数据失败:', error);
        this.setState({ loading: false });
        return;
      }
      
      // 获取统计数据
      const { data: statsData } = await supabase
        .from('scores')
        .select('time, score, is_cheating', { count: 'exact' });
      
      const totalRecords = statsData.length;
      const cheatRecords = statsData.filter(record => record.is_cheating).length;
      const averageTime = statsData.reduce((sum, record) => sum + record.time, 0) / totalRecords || 0;
      const highestScore = Math.max(...statsData.map(record => record.score)) || 0;
      const lowestScore = Math.min(...statsData.map(record => record.score)) || 0;
      
      this.setState({
        adminRecords: data,
        stats: {
          totalRecords,
          cheatRecords,
          averageTime: Math.round(averageTime * 100) / 100,
          highestScore,
          lowestScore
        },
        loading: false
      });
    } catch (error) {
      console.error('获取管理数据失败:', error);
      this.setState({ loading: false });
    }
  };

  // 删除记录
  deleteRecord = async (id) => {
    if (!confirm('确定要删除这条记录吗？')) return;
    
    try {
      this.setState({ loading: true });
      
      const { error } = await supabase
        .from('scores')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('删除记录失败:', error);
        alert('删除失败');
        this.setState({ loading: false });
        return;
      }
      
      alert('删除成功');
      this.getAdminRecords();
    } catch (error) {
      console.error('删除记录失败:', error);
      alert('删除失败');
      this.setState({ loading: false });
    }
  };

  // 批量删除作弊记录
  deleteCheatRecords = async () => {
    if (!confirm('确定要删除所有作弊记录吗？')) return;
    
    try {
      this.setState({ loading: true });
      
      const { error } = await supabase
        .from('scores')
        .delete()
        .eq('is_cheating', true);
      
      if (error) {
        console.error('批量删除失败:', error);
        alert('删除失败');
        this.setState({ loading: false });
        return;
      }
      
      alert('作弊记录删除成功');
      this.getAdminRecords();
    } catch (error) {
      console.error('批量删除失败:', error);
      alert('删除失败');
      this.setState({ loading: false });
    }
  };

  // 重新检测所有记录
  recheckAllRecords = async () => {
    try {
      this.setState({ loading: true });
      
      // 获取所有记录
      const { data: allRecords, error: fetchError } = await supabase
        .from('scores')
        .select('*');
      
      if (fetchError) {
        console.error('获取记录失败:', fetchError);
        alert('重新检测失败');
        this.setState({ loading: false });
        return;
      }
      
      // 重新检测每个记录
      for (const record of allRecords) {
        // 这里简化处理，实际应该根据游戏数据重新检测
        // 由于我们没有存储游戏过程数据，这里只是模拟
        const isCheating = record.is_cheating;
        const cheatReason = record.cheat_reason;
        
        // 更新记录
        await supabase
          .from('scores')
          .update({ is_cheating, cheat_reason: cheatReason })
          .eq('id', record.id);
      }
      
      alert('重新检测完成');
      this.getAdminRecords();
    } catch (error) {
      console.error('重新检测失败:', error);
      alert('重新检测失败');
      this.setState({ loading: false });
    }
  };

  // 导出CSV
  exportCSV = () => {
    const { adminRecords } = this.state;
    
    if (adminRecords.length === 0) {
      alert('没有数据可导出');
      return;
    }
    
    const headers = ['ID', '昵称', '用时(秒)', '得分', '提交时间', '是否作弊', '作弊原因'];
    const csvContent = [
      headers.join(','),
      ...adminRecords.map(record => [
        record.id,
        `"${record.nickname}"`,
        record.time,
        record.score,
        new Date(record.created_at).toISOString(),
        record.is_cheating ? '是' : '否',
        `"${record.cheat_reason || ''}"`
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `三角速算成绩_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 验证管理后台密码
  verifyAdminPassword = () => {
    const correctPassword = '12345678910109876543210';
    if (this.state.adminPassword === correctPassword) {
      this.setState({ currentPage: 'admin', adminPassword: '' });
    } else {
      this.setState({ errorMessage: '密码错误，请重新输入' });
    }
  };

  // 渲染管理后台登录页面
  renderAdminLogin = () => {
    return (
      <div className="container">
        <h1>管理后台登录</h1>
        {this.state.errorMessage && (
          <div className="error-message">{this.state.errorMessage}</div>
        )}
        <div className="input-group">
          <input
            type="password"
            placeholder="请输入管理后台密码"
            value={this.state.adminPassword}
            onChange={(e) => this.setState({ adminPassword: e.target.value, errorMessage: '' })}
          />
        </div>
        <div style={{ textAlign: 'center' }}>
          <button className="btn-primary" onClick={this.verifyAdminPassword}>
            登录
          </button>
          <button className="btn-secondary" onClick={() => this.setState({ currentPage: 'home', adminPassword: '', errorMessage: '' })}>
            返回首页
          </button>
        </div>
      </div>
    );
  };

  // 渲染首页
  renderHome = () => {
    return (
      <div className="container">
        <h1>三角速算冲冲冲</h1>
        {this.state.errorMessage && (
          <div className="error-message">{this.state.errorMessage}</div>
        )}
        <div className="input-group">
          <input
            type="text"
            placeholder="请输入昵称"
            value={this.state.nickname}
            onChange={(e) => this.setState({ nickname: e.target.value })}
          />
        </div>
        <div style={{ textAlign: 'center' }}>
          <button className="btn-primary" onClick={this.startGame}>
            开始挑战
          </button>
          <button className="btn-secondary" onClick={() => this.setState({ currentPage: 'history' })}>
            我的成绩
          </button>
          <button className="btn-secondary" onClick={() => this.setState({ currentPage: 'leaderboard' })}>
            排行榜
          </button>
          <button className="btn-secondary" onClick={() => this.setState({ currentPage: 'adminLogin' })}>
            管理后台
          </button>
          <button className="btn-secondary" onClick={this.syncOfflineScores}>
            同步离线成绩
          </button>
        </div>
      </div>
    );
  };

  // 渲染游戏页面
  renderGame = () => {
    const { questions, currentQuestionIndex, startTime, isGameOver, totalTime, score, isCheating, cheatReason } = this.state;
    
    if (isGameOver) {
      return (
        <div className="result-modal">
          <div className="result-content">
            <h2>挑战完成！</h2>
            <p>总用时：{totalTime.toFixed(2)} 秒</p>
            <p>得分：{score} 分</p>
            {isCheating && (
              <p style={{ color: '#f44336' }}>作弊标记：{cheatReason}</p>
            )}
            <div>
              <button className="btn-primary" onClick={this.saveScore} disabled={this.state.loading}>
                {this.state.loading ? '保存中...' : '保存成绩'}
              </button>
              <button className="btn-secondary" onClick={this.startGame}>
                再玩一次
              </button>
              <button className="btn-secondary" onClick={() => this.setState({ currentPage: 'home' })}>
                返回首页
              </button>
            </div>
          </div>
        </div>
      );
    }

    const currentQuestion = questions[currentQuestionIndex];
    const shuffledOptions = shuffleArray([...allOptions]);
    const elapsedTime = (Date.now() - startTime) / 1000;

    return (
      <div className="container">
        <div className="game-header">
          <div>
            <h2>三角速算冲冲冲</h2>
            <p>昵称：{this.state.nickname}</p>
          </div>
          <div className="game-progress">
            第 {currentQuestionIndex + 1}/9 题
          </div>
          <div className="game-timer">
            用时：{elapsedTime.toFixed(2)} 秒
          </div>
        </div>
        <div className="question-container">
          <div className="question-text">
            {currentQuestion.question} = ?
          </div>
          <div className="options-grid">
            {shuffledOptions.map((option, index) => (
              <button
                key={index}
                className="option-btn"
                onClick={(e) => this.handleOptionClick(option, index, e)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // 渲染历史成绩页面
  renderHistory = () => {
    if (this.state.historicalScores.length === 0 && !this.state.loading) {
      this.getHistoricalScores();
    }

    return (
      <div className="container">
        <h1>我的成绩</h1>
        <h2>{this.state.nickname}</h2>
        {this.state.loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>加载中...</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>提交时间</th>
                  <th>用时(秒)</th>
                  <th>得分</th>
                  <th>是否作弊</th>
                  <th>作弊原因</th>
                </tr>
              </thead>
              <tbody>
                {this.state.historicalScores.map((record) => (
                  <tr key={record.id}>
                    <td>{new Date(record.created_at).toLocaleString()}</td>
                    <td>{record.time.toFixed(2)}</td>
                    <td>{record.score}</td>
                    <td>{record.is_cheating ? '是' : '否'}</td>
                    <td>{record.cheat_reason || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {this.state.historicalScores.length === 0 && (
              <p style={{ textAlign: 'center', padding: '20px' }}>暂无成绩记录</p>
            )}
          </div>
        )}
        <div className="nav-buttons">
          <button className="btn-secondary" onClick={() => this.setState({ currentPage: 'home' })}>
            返回首页
          </button>
        </div>
      </div>
    );
  };

  // 渲染排行榜页面
  renderLeaderboard = () => {
    if (this.state.leaderboard.length === 0 && !this.state.loading) {
      this.getLeaderboard();
    }

    return (
      <div className="container">
        <h1>排行榜</h1>
        {this.state.loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>加载中...</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>排名</th>
                  <th>昵称</th>
                  <th>用时(秒)</th>
                  <th>得分</th>
                  <th>提交时间</th>
                </tr>
              </thead>
              <tbody>
                {this.state.leaderboard.map((record, index) => (
                  <tr key={record.id}>
                    <td>{index + 1}</td>
                    <td>{record.nickname}</td>
                    <td>{record.time.toFixed(2)}</td>
                    <td>{record.score}</td>
                    <td>{new Date(record.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {this.state.leaderboard.length === 0 && (
              <p style={{ textAlign: 'center', padding: '20px' }}>暂无排行数据</p>
            )}
          </div>
        )}
        <div className="nav-buttons">
          <button className="btn-secondary" onClick={() => this.setState({ currentPage: 'home' })}>
            返回首页
          </button>
        </div>
      </div>
    );
  };

  // 渲染管理后台页面
  renderAdmin = () => {
    if (this.state.adminRecords.length === 0 && !this.state.loading) {
      this.getAdminRecords();
    }

    return (
      <div className="container">
        <h1>管理后台</h1>
        
        {/* 统计摘要 */}
        <div className="stats-summary">
          <div className="stat-item">
            <div className="stat-value">{this.state.stats.totalRecords}</div>
            <div className="stat-label">总记录数</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{this.state.stats.cheatRecords}</div>
            <div className="stat-label">作弊记录数</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{this.state.stats.averageTime}</div>
            <div className="stat-label">平均用时(秒)</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{this.state.stats.highestScore}</div>
            <div className="stat-label">最高分</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{this.state.stats.lowestScore}</div>
            <div className="stat-label">最低分</div>
          </div>
        </div>

        {/* 筛选和操作 */}
        <div className="filter-controls">
          <input
            type="text"
            placeholder="搜索昵称"
            value={this.state.searchTerm}
            onChange={(e) => this.setState({ searchTerm: e.target.value })}
          />
          <select
            value={this.state.cheatFilter}
            onChange={(e) => this.setState({ cheatFilter: e.target.value })}
          >
            <option value="all">全部</option>
            <option value="cheat">作弊</option>
            <option value="normal">正常</option>
          </select>
          <select
            value={this.state.sortBy}
            onChange={(e) => this.setState({ sortBy: e.target.value })}
          >
            <option value="score">得分</option>
            <option value="time">用时</option>
            <option value="created_at">提交时间</option>
          </select>
          <select
            value={this.state.sortOrder}
            onChange={(e) => this.setState({ sortOrder: e.target.value })}
          >
            <option value="desc">降序</option>
            <option value="asc">升序</option>
          </select>
          <button className="btn-primary" onClick={this.getAdminRecords}>
            应用筛选
          </button>
          <button className="btn-danger" onClick={this.deleteCheatRecords}>
            批量删除作弊记录
          </button>
          <button className="btn-secondary" onClick={this.recheckAllRecords}>
            重新检测所有记录
          </button>
          <button className="btn-secondary" onClick={this.exportCSV}>
            导出CSV
          </button>
        </div>

        {/* 数据表格 */}
        {this.state.loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>加载中...</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>昵称</th>
                  <th>用时(秒)</th>
                  <th>得分</th>
                  <th>提交时间</th>
                  <th>是否作弊</th>
                  <th>作弊原因</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {this.state.adminRecords.map((record) => (
                  <tr key={record.id}>
                    <td>{record.id}</td>
                    <td>{record.nickname}</td>
                    <td>{record.time.toFixed(2)}</td>
                    <td>{record.score}</td>
                    <td>{new Date(record.created_at).toLocaleString()}</td>
                    <td>{record.is_cheating ? '是' : '否'}</td>
                    <td>{record.cheat_reason || '-'}</td>
                    <td>
                      <button className="btn-danger" onClick={() => this.deleteRecord(record.id)}>
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {this.state.adminRecords.length === 0 && (
              <p style={{ textAlign: 'center', padding: '20px' }}>暂无数据</p>
            )}
          </div>
        )}

        {/* 分页 */}
        <div className="pagination">
          <button 
            className="btn-secondary" 
            onClick={() => this.setState({ currentPageAdmin: Math.max(1, this.state.currentPageAdmin - 1) }, this.getAdminRecords)}
            disabled={this.state.currentPageAdmin === 1}
          >
            上一页
          </button>
          <span>第 {this.state.currentPageAdmin} 页</span>
          <button 
            className="btn-secondary" 
            onClick={() => this.setState({ currentPageAdmin: this.state.currentPageAdmin + 1 }, this.getAdminRecords)}
            disabled={this.state.adminRecords.length < this.state.pageSize}
          >
            下一页
          </button>
        </div>

        <div className="nav-buttons">
          <button className="btn-secondary" onClick={() => this.setState({ currentPage: 'home' })}>
            返回首页
          </button>
        </div>
      </div>
    );
  };

  // 渲染当前页面
  render() {
    switch (this.state.currentPage) {
      case 'home':
        return this.renderHome();
      case 'game':
        return this.renderGame();
      case 'history':
        return this.renderHistory();
      case 'leaderboard':
        return this.renderLeaderboard();
      case 'adminLogin':
        return this.renderAdminLogin();
      case 'admin':
        return this.renderAdmin();
      default:
        return this.renderHome();
    }
  }
}

// 渲染应用
ReactDOM.render(<App />, document.getElementById('root'));