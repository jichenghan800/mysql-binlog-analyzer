class BinlogAnalyzer {
    constructor() {
        this.operations = [];
        this.filteredOperations = [];
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');

        // 文件上传事件
        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
        uploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
        uploadArea.addEventListener('drop', this.handleDrop.bind(this));
        fileInput.addEventListener('change', this.handleFileSelect.bind(this));

        // 筛选和排序事件
        document.getElementById('typeFilter').addEventListener('change', this.applyFilters.bind(this));
        document.getElementById('databaseFilter').addEventListener('change', this.applyFilters.bind(this));
        document.getElementById('tableFilter').addEventListener('change', this.applyFilters.bind(this));
        document.getElementById('sortBy').addEventListener('change', this.applyFilters.bind(this));
        document.getElementById('startTime').addEventListener('change', this.applyFilters.bind(this));
        document.getElementById('endTime').addEventListener('change', this.applyFilters.bind(this));
    }

    handleDragOver(e) {
        e.preventDefault();
        document.getElementById('uploadArea').classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        document.getElementById('uploadArea').classList.remove('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        document.getElementById('uploadArea').classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.uploadFile(files[0]);
        }
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.uploadFile(file);
        }
    }

    async uploadFile(file) {
        // 检查文件大小
        const fileSizeInMB = file.size / (1024 * 1024);
        console.log(`文件大小: ${fileSizeInMB.toFixed(2)} MB`);
        
        if (fileSizeInMB > 100) {
            const confirmed = confirm(`文件大小为 ${fileSizeInMB.toFixed(2)} MB，解析可能需要较长时间。是否继续？`);
            if (!confirmed) {
                return;
            }
        }

        const formData = new FormData();
        formData.append('binlogFile', file);

        const progressBar = document.querySelector('#uploadProgress .progress-bar');
        const progressContainer = document.getElementById('uploadProgress');
        const progressText = document.querySelector('#uploadProgress .progress-text') || 
                           document.createElement('div');
        
        if (!progressText.classList.contains('progress-text')) {
            progressText.className = 'progress-text text-center mt-2';
            progressContainer.appendChild(progressText);
        }
        
        progressContainer.classList.remove('d-none');
        progressBar.style.width = '0%';
        progressText.textContent = '正在上传文件...';

        try {
            let progress = 0;
            let stage = 'upload';
            
            const progressInterval = setInterval(() => {
                if (stage === 'upload') {
                    progress += Math.random() * 20;
                    if (progress > 70) {
                        progress = 70;
                        stage = 'parse';
                        progressText.textContent = '正在解析binlog文件...';
                    }
                } else if (stage === 'parse') {
                    progress += Math.random() * 5;
                    if (progress > 90) progress = 90;
                }
                progressBar.style.width = progress + '%';
            }, 500);

            const startTime = Date.now();
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            clearInterval(progressInterval);
            progressBar.style.width = '100%';
            progressText.textContent = '解析完成！';

            const result = await response.json();
            const endTime = Date.now();
            const duration = ((endTime - startTime) / 1000).toFixed(1);

            if (result.success) {
                this.operations = result.operations;
                this.displayResults();
                
                let message = `文件解析成功！耗时 ${duration} 秒，找到 ${result.total} 个操作`;
                if (result.memoryUsage) {
                    message += `，内存使用 ${result.memoryUsage.heapUsed} MB`;
                }
                
                this.showNotification(message, 'success');
            } else {
                this.showNotification('解析失败: ' + result.error, 'error');
            }
        } catch (error) {
            let errorMessage = '上传失败: ';
            
            if (error.message.includes('Failed to fetch')) {
                errorMessage += '网络连接失败或服务器无响应';
            } else if (error.message.includes('413')) {
                errorMessage += '文件过大，请尝试较小的文件';
            } else {
                errorMessage += error.message;
            }
            
            this.showNotification(errorMessage, 'error');
        } finally {
            setTimeout(() => {
                progressContainer.classList.add('d-none');
            }, 2000);
        }
    }

    async displayResults() {
        // 显示统计信息
        await this.displayStatistics();
        
        // 填充筛选选项
        this.populateFilters();
        
        // 设置默认时间范围
        this.setDefaultTimeRange();
        
        // 显示操作列表
        this.applyFilters();
        
        // 显示相关区域
        document.getElementById('statsSection').classList.remove('d-none');
        document.getElementById('filterSection').classList.remove('d-none');
        document.getElementById('operationsSection').classList.remove('d-none');
    }

    setDefaultTimeRange() {
        if (this.operations.length === 0) return;
        
        // 获取所有有效的时间戳
        const timestamps = this.operations
            .map(op => this.parseTimestamp(op.timestamp))
            .filter(t => t !== null)
            .sort((a, b) => a - b);
        
        if (timestamps.length > 0) {
            const earliest = timestamps[0];
            const latest = timestamps[timestamps.length - 1];
            
            const startTimeInput = document.getElementById('startTime');
            const endTimeInput = document.getElementById('endTime');
            
            // 只设置输入框的最小和最大值，不设置默认值
            // 这样时间筛选默认不生效，用户需要手动选择
            startTimeInput.min = this.formatDateTimeLocal(earliest);
            startTimeInput.max = this.formatDateTimeLocal(latest);
            endTimeInput.min = this.formatDateTimeLocal(earliest);
            endTimeInput.max = this.formatDateTimeLocal(latest);
            
            // 设置placeholder提示用户时间范围
            startTimeInput.placeholder = `最早: ${this.formatDateTime(earliest)}`;
            endTimeInput.placeholder = `最晚: ${this.formatDateTime(latest)}`;
            
            // 清空默认值，确保时间筛选不自动生效
            startTimeInput.value = '';
            endTimeInput.value = '';
        }
    }

    formatDateTimeLocal(date) {
        // 格式化为 YYYY-MM-DDTHH:mm 格式
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    async displayStatistics() {
        try {
            const response = await fetch('/statistics', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ operations: this.operations })
            });

            const stats = await response.json();

            document.getElementById('totalOperations').textContent = stats.total;
            document.getElementById('insertCount').textContent = stats.byType.INSERT || 0;
            document.getElementById('updateCount').textContent = stats.byType.UPDATE || 0;
            document.getElementById('deleteCount').textContent = stats.byType.DELETE || 0;

        } catch (error) {
            console.error('获取统计信息失败:', error);
        }
    }

    populateFilters() {
        const databases = [...new Set(this.operations.map(op => op.database))];
        const tables = [...new Set(this.operations.map(op => op.table))];

        const databaseFilter = document.getElementById('databaseFilter');
        const tableFilter = document.getElementById('tableFilter');

        // 清空现有选项
        databaseFilter.innerHTML = '<option value="">全部</option>';
        tableFilter.innerHTML = '<option value="">全部</option>';

        // 添加数据库选项
        databases.forEach(db => {
            const option = document.createElement('option');
            option.value = db;
            option.textContent = db;
            databaseFilter.appendChild(option);
        });

        // 添加表选项
        tables.forEach(table => {
            const option = document.createElement('option');
            option.value = table;
            option.textContent = table;
            tableFilter.appendChild(option);
        });
    }

    applyFilters() {
        const typeFilter = document.getElementById('typeFilter').value;
        const databaseFilter = document.getElementById('databaseFilter').value;
        const tableFilter = document.getElementById('tableFilter').value;
        const sortBy = document.getElementById('sortBy').value;
        const startTime = document.getElementById('startTime').value;
        const endTime = document.getElementById('endTime').value;

        // 应用筛选
        this.filteredOperations = this.operations.filter(op => {
            // 基本筛选
            const basicFilter = (!typeFilter || op.type === typeFilter) &&
                               (!databaseFilter || op.database === databaseFilter) &&
                               (!tableFilter || op.table === tableFilter);
            
            if (!basicFilter) return false;
            
            // 时间筛选
            if (startTime || endTime) {
                const opTime = this.parseTimestamp(op.timestamp);
                if (!opTime) return false;
                
                if (startTime) {
                    const start = new Date(startTime);
                    if (opTime < start) return false;
                }
                
                if (endTime) {
                    const end = new Date(endTime);
                    if (opTime > end) return false;
                }
            }
            
            return true;
        });

        // 应用排序
        this.filteredOperations.sort((a, b) => {
            switch (sortBy) {
                case 'timestamp':
                    const timeA = this.parseTimestamp(a.timestamp);
                    const timeB = this.parseTimestamp(b.timestamp);
                    return (timeA || new Date(0)) - (timeB || new Date(0));
                case 'type':
                    return a.type.localeCompare(b.type);
                case 'database':
                    return a.database.localeCompare(b.database);
                case 'table':
                    return a.table.localeCompare(b.table);
                default:
                    return 0;
            }
        });

        this.displayOperations();
        this.updateFilterSummary();
    }

    parseTimestamp(timestamp) {
        if (!timestamp || timestamp === 'N/A' || timestamp === 'null' || timestamp === 'undefined') {
            return null;
        }
        
        try {
            // 清理时间戳字符串
            const cleanTimestamp = timestamp.toString().trim();
            
            // 检查是否为空或无效
            if (!cleanTimestamp || cleanTimestamp === 'N/A') {
                return null;
            }
            
            // 尝试解析不同的时间格式
            if (cleanTimestamp.includes('T')) {
                // ISO格式: 2024-12-01T10:30:21
                return new Date(cleanTimestamp);
            } else if (cleanTimestamp.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
                // 标准格式: 2024-12-01 10:30:21
                return new Date(cleanTimestamp);
            } else if (cleanTimestamp.match(/^\d{2}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
                // 短格式: 24-12-01 10:30:21
                const parts = cleanTimestamp.split(' ');
                const dateParts = parts[0].split('-');
                const year = '20' + dateParts[0];
                const formattedDate = `${year}-${dateParts[1]}-${dateParts[2]} ${parts[1]}`;
                return new Date(formattedDate);
            } else if (cleanTimestamp.match(/^\d+$/)) {
                // Unix时间戳
                const unixTimestamp = parseInt(cleanTimestamp);
                // 检查是否为合理的时间戳（1970年后）
                if (unixTimestamp > 0 && unixTimestamp < 9999999999) {
                    return new Date(unixTimestamp * 1000);
                } else if (unixTimestamp > 9999999999) {
                    return new Date(unixTimestamp);
                }
                return null;
            } else {
                // 尝试直接解析
                const date = new Date(cleanTimestamp);
                // 检查日期是否有效且不是1970年
                if (isNaN(date.getTime()) || date.getFullYear() < 1990) {
                    return null;
                }
                return date;
            }
        } catch (error) {
            console.warn('无法解析时间戳:', timestamp, error);
            return null;
        }
    }

    applyTimeFilter() {
        this.applyFilters();
        this.showNotification('时间筛选已应用', 'success');
    }

    clearTimeFilter() {
        document.getElementById('startTime').value = '';
        document.getElementById('endTime').value = '';
        this.applyFilters();
        this.showNotification('时间筛选已清除', 'success');
    }

    setTimeRange(range) {
        if (this.operations.length === 0) return;
        
        // 获取所有有效的时间戳
        const timestamps = this.operations
            .map(op => this.parseTimestamp(op.timestamp))
            .filter(t => t !== null)
            .sort((a, b) => a - b);
        
        if (timestamps.length === 0) return;
        
        const earliest = timestamps[0];
        const latest = timestamps[timestamps.length - 1];
        const now = new Date();
        
        const startTimeInput = document.getElementById('startTime');
        const endTimeInput = document.getElementById('endTime');
        
        let startTime, endTime;
        
        switch (range) {
            case 'all':
                startTime = earliest;
                endTime = latest;
                break;
            case 'last1h':
                endTime = latest;
                startTime = new Date(latest.getTime() - 60 * 60 * 1000); // 1小时前
                if (startTime < earliest) startTime = earliest;
                break;
            case 'last6h':
                endTime = latest;
                startTime = new Date(latest.getTime() - 6 * 60 * 60 * 1000); // 6小时前
                if (startTime < earliest) startTime = earliest;
                break;
            case 'today':
                const today = new Date(latest);
                today.setHours(0, 0, 0, 0);
                startTime = today > earliest ? today : earliest;
                endTime = latest;
                break;
            default:
                return;
        }
        
        startTimeInput.value = this.formatDateTimeLocal(startTime);
        endTimeInput.value = this.formatDateTimeLocal(endTime);
        
        this.applyTimeFilter();
    }

    updateFilterSummary() {
        const totalCount = this.operations.length;
        const filteredCount = this.filteredOperations.length;
        
        // 更新筛选计数显示
        const filteredCountElement = document.getElementById('filteredCount');
        if (filteredCount < totalCount) {
            filteredCountElement.textContent = `${filteredCount} / ${totalCount} 条记录 (已筛选)`;
            filteredCountElement.className = 'badge bg-warning';
        } else {
            filteredCountElement.textContent = `${filteredCount} 条记录`;
            filteredCountElement.className = 'badge bg-primary';
        }
        
        // 显示时间范围信息
        this.displayTimeRange();
    }

    displayTimeRange() {
        const timeRangeElement = document.getElementById('timeRange') || this.createTimeRangeElement();
        
        if (this.filteredOperations.length === 0) {
            timeRangeElement.textContent = '';
            return;
        }
        
        const timestamps = this.filteredOperations
            .map(op => this.parseTimestamp(op.timestamp))
            .filter(t => t !== null)
            .sort((a, b) => a - b);
        
        if (timestamps.length > 0) {
            const earliest = timestamps[0];
            const latest = timestamps[timestamps.length - 1];
            
            if (earliest.getTime() === latest.getTime()) {
                timeRangeElement.textContent = `时间: ${this.formatDateTime(earliest)}`;
            } else {
                timeRangeElement.textContent = `时间范围: ${this.formatDateTime(earliest)} ~ ${this.formatDateTime(latest)}`;
            }
        } else {
            timeRangeElement.textContent = '';
        }
    }

    createTimeRangeElement() {
        const element = document.createElement('small');
        element.id = 'timeRange';
        element.className = 'text-muted d-block mt-1';
        
        const cardHeader = document.querySelector('#operationsSection .card-header');
        cardHeader.appendChild(element);
        
        return element;
    }

    formatDateTime(date) {
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    formatTimestamp(timestamp) {
        if (!timestamp || timestamp === 'N/A') {
            return 'N/A';
        }
        
        const date = this.parseTimestamp(timestamp);
        if (!date) {
            return timestamp; // 如果无法解析，返回原始值
        }
        
        return this.formatDateTime(date);
    }

    displayOperations() {
        const tbody = document.getElementById('operationsTable');
        const filteredCount = document.getElementById('filteredCount');
        
        tbody.innerHTML = '';
        filteredCount.textContent = `${this.filteredOperations.length} 条记录`;

        this.filteredOperations.forEach((op, index) => {
            const row = document.createElement('tr');
            row.className = `operation-${op.type.toLowerCase()}`;
            
            const operationDetails = this.formatOperationDetails(op);
            
            const formattedTime = this.formatTimestamp(op.timestamp);
            
            row.innerHTML = `
                <td>${formattedTime}</td>
                <td>
                    <span class="badge bg-${this.getTypeBadgeColor(op.type)}">${op.type}</span>
                </td>
                <td>${op.database}</td>
                <td>${op.table}</td>
                <td>${op.serverId || 'N/A'}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="analyzer.showOperationDetails(${index})">
                        <i class="fas fa-eye"></i> 查看详情
                    </button>
                </td>
            `;
            
            tbody.appendChild(row);
        });
    }

    formatOperationDetails(operation) {
        let details = '';
        
        if (operation.type === 'UPDATE') {
            if (operation.setValues && operation.setValues.length > 0) {
                details += 'SET: ' + operation.setValues.map(v => `@${v.column}=${v.value}`).join(', ');
            }
            if (operation.whereConditions && operation.whereConditions.length > 0) {
                details += ' WHERE: ' + operation.whereConditions.map(w => `@${w.column}=${w.value}`).join(', ');
            }
        } else {
            if (operation.values && operation.values.length > 0) {
                details += '值: ' + operation.values.map(v => `@${v.column}=${v.value}`).join(', ');
            }
        }
        
        return details || '无详细信息';
    }

    getTypeBadgeColor(type) {
        switch (type) {
            case 'INSERT': return 'success';
            case 'UPDATE': return 'warning';
            case 'DELETE': return 'danger';
            default: return 'secondary';
        }
    }

    // 高亮SQL中的不同值
    highlightSQLDifferences(originalSQL, reverseSQL) {
        if (!originalSQL || !reverseSQL) {
            return {
                original: originalSQL || '无法生成SQL',
                reverse: reverseSQL || '无法生成回滚SQL'
            };
        }

        // 提取SQL中的值（简单的正则匹配）
        const extractValues = (sql) => {
            const values = [];
            // 匹配 = 后面的值
            const matches = sql.match(/=\s*([^,\s)]+)/g);
            if (matches) {
                matches.forEach(match => {
                    const value = match.replace(/=\s*/, '').trim();
                    values.push(value);
                });
            }
            return values;
        };

        const originalValues = extractValues(originalSQL);
        const reverseValues = extractValues(reverseSQL);

        let highlightedOriginal = originalSQL;
        let highlightedReverse = reverseSQL;

        // 为不同的值添加高亮
        originalValues.forEach((value, index) => {
            if (reverseValues[index] && value !== reverseValues[index]) {
                // 高亮原始SQL中的值（绿色背景）
                const regex = new RegExp(`(=\\s*)(${this.escapeRegex(value)})`, 'g');
                highlightedOriginal = highlightedOriginal.replace(regex, 
                    `$1<span style="background-color: #d4edda; color: #155724; padding: 2px 4px; border-radius: 3px;">$2</span>`);
            }
        });

        reverseValues.forEach((value, index) => {
            if (originalValues[index] && value !== originalValues[index]) {
                // 高亮回滚SQL中的值（红色背景）
                const regex = new RegExp(`(=\\s*)(${this.escapeRegex(value)})`, 'g');
                highlightedReverse = highlightedReverse.replace(regex, 
                    `$1<span style="background-color: #f8d7da; color: #721c24; padding: 2px 4px; border-radius: 3px;">$2</span>`);
            }
        });

        return {
            original: highlightedOriginal,
            reverse: highlightedReverse
        };
    }

    // 转义正则表达式特殊字符
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    showOperationDetails(index) {
        const operation = this.filteredOperations[index];
        
        // 高亮SQL差异
        const highlightedSQL = this.highlightSQLDifferences(operation.originalSQL, operation.reverseSQL);
        
        let modalContent = `
            <div class="modal fade" id="operationModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <span class="badge bg-${this.getTypeBadgeColor(operation.type)}">${operation.type}</span>
                                操作详情
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row mb-3">
                                <div class="col-md-6">
                                    <strong>时间:</strong> ${this.formatTimestamp(operation.timestamp)}
                                </div>
                                <div class="col-md-6">
                                    <strong>服务器ID:</strong> ${operation.serverId || 'N/A'}
                                </div>
                            </div>
                            <div class="row mb-3">
                                <div class="col-md-6">
                                    <strong>数据库:</strong> ${operation.database}
                                </div>
                                <div class="col-md-6">
                                    <strong>表名:</strong> ${operation.table}
                                </div>
                            </div>
        `;

        if (operation.type === 'UPDATE') {
            if (operation.setValues && operation.setValues.length > 0) {
                modalContent += `
                    <h6>SET 值 (新值):</h6>
                    <div class="table-responsive">
                        <table class="table table-sm">
                            <thead><tr><th>列</th><th>新值</th></tr></thead>
                            <tbody>
                                ${operation.setValues.map(v => {
                                    // 检查是否有对应的WHERE条件值不同
                                    const whereValue = operation.whereConditions?.find(w => w.column === v.column);
                                    const isDifferent = whereValue && whereValue.value !== v.value;
                                    const bgColor = isDifferent ? 'background-color: #d4edda;' : '';
                                    return `<tr><td>@${v.column}</td><td style="${bgColor}">${v.value}</td></tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            }

            if (operation.whereConditions && operation.whereConditions.length > 0) {
                modalContent += `
                    <h6>WHERE 条件 (旧值):</h6>
                    <div class="table-responsive">
                        <table class="table table-sm">
                            <thead><tr><th>列</th><th>旧值</th></tr></thead>
                            <tbody>
                                ${operation.whereConditions.map(w => {
                                    // 检查是否有对应的SET值不同
                                    const setValue = operation.setValues?.find(s => s.column === w.column);
                                    const isDifferent = setValue && setValue.value !== w.value;
                                    const bgColor = isDifferent ? 'background-color: #f8d7da;' : '';
                                    return `<tr><td>@${w.column}</td><td style="${bgColor}">${w.value}</td></tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            }
        } else {
            if (operation.values && operation.values.length > 0) {
                modalContent += `
                    <h6>操作值:</h6>
                    <div class="table-responsive">
                        <table class="table table-sm">
                            <thead><tr><th>列</th><th>值</th></tr></thead>
                            <tbody>
                                ${operation.values.map(v => `<tr><td>@${v.column}</td><td>${v.value}</td></tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            }
        }

        modalContent += `
                            <div class="row mt-4">
                                <div class="col-12">
                                    <h6>SQL语句: <small class="text-muted">(不同的值已用颜色标识)</small></h6>
                                    <div class="row">
                                        <div class="col-md-6">
                                            <label class="form-label">
                                                <strong>原始SQL:</strong>
                                                <span class="badge bg-success ms-2" style="font-size: 0.7em;">新值</span>
                                            </label>
                                            <div class="bg-light p-3 rounded" style="border-left: 4px solid #28a745;">
                                                <code style="white-space: pre-wrap; word-break: break-all;">${highlightedSQL.original}</code>
                                            </div>
                                            <button class="btn btn-sm btn-outline-primary mt-2" onclick="analyzer.copyToClipboard('${operation.originalSQL?.replace(/'/g, "\\'")}')">
                                                <i class="fas fa-copy"></i> 复制原始SQL
                                            </button>
                                        </div>
                                        <div class="col-md-6">
                                            <label class="form-label">
                                                <strong>回滚SQL:</strong>
                                                <span class="badge bg-danger ms-2" style="font-size: 0.7em;">旧值</span>
                                            </label>
                                            <div class="bg-light p-3 rounded" style="border-left: 4px solid #dc3545;">
                                                <code style="white-space: pre-wrap; word-break: break-all;">${highlightedSQL.reverse}</code>
                                            </div>
                                            <button class="btn btn-sm btn-outline-warning mt-2" onclick="analyzer.copyToClipboard('${operation.reverseSQL?.replace(/'/g, "\\'")}')">
                                                <i class="fas fa-copy"></i> 复制回滚SQL
                                            </button>
                                        </div>
                                    </div>
                                    <div class="row mt-3">
                                        <div class="col-12">
                                            <div class="alert alert-info py-2">
                                                <small>
                                                    <i class="fas fa-info-circle"></i>
                                                    <strong>颜色说明:</strong>
                                                    <span class="ms-2" style="background-color: #d4edda; color: #155724; padding: 2px 6px; border-radius: 3px;">绿色</span> 表示新值（原始SQL）
                                                    <span class="ms-2" style="background-color: #f8d7da; color: #721c24; padding: 2px 6px; border-radius: 3px;">红色</span> 表示旧值（回滚SQL）
                                                </small>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 移除现有模态框
        const existingModal = document.getElementById('operationModal');
        if (existingModal) {
            existingModal.remove();
        }

        // 添加新模态框
        document.body.insertAdjacentHTML('beforeend', modalContent);
        
        // 显示模态框
        const modal = new bootstrap.Modal(document.getElementById('operationModal'));
        modal.show();
    }

    showSQL(index, type) {
        const operation = this.filteredOperations[index];
        const sql = type === 'original' ? operation.originalSQL : operation.reverseSQL;
        const title = type === 'original' ? '原始SQL' : '回滚SQL';
        const badgeColor = type === 'original' ? 'success' : 'warning';
        
        let modalContent = `
            <div class="modal fade" id="sqlModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <span class="badge bg-${badgeColor}">${title}</span>
                                ${operation.database}.${operation.table} - ${operation.type}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label"><strong>SQL语句:</strong></label>
                                <div class="bg-dark text-light p-3 rounded" style="font-family: 'Courier New', monospace;">
                                    <pre style="margin: 0; white-space: pre-wrap; word-break: break-all;">${sql || '无法生成SQL语句'}</pre>
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-6">
                                    <small class="text-muted">时间: ${operation.timestamp || 'N/A'}</small>
                                </div>
                                <div class="col-md-6">
                                    <small class="text-muted">服务器ID: ${operation.serverId || 'N/A'}</small>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline-primary" onclick="analyzer.copyToClipboard('${sql?.replace(/'/g, "\\'")}')">
                                <i class="fas fa-copy"></i> 复制SQL
                            </button>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 移除现有模态框
        const existingModal = document.getElementById('sqlModal');
        if (existingModal) {
            existingModal.remove();
        }

        // 添加新模态框
        document.body.insertAdjacentHTML('beforeend', modalContent);
        
        // 显示模态框
        const modal = new bootstrap.Modal(document.getElementById('sqlModal'));
        modal.show();
    }

    copyToClipboard(text) {
        if (!text) {
            this.showNotification('没有可复制的内容', 'error');
            return;
        }

        navigator.clipboard.writeText(text).then(() => {
            this.showNotification('SQL已复制到剪贴板', 'success');
        }).catch(err => {
            console.error('复制失败:', err);
            // 降级方案
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                this.showNotification('SQL已复制到剪贴板', 'success');
            } catch (err) {
                this.showNotification('复制失败', 'error');
            }
            document.body.removeChild(textArea);
        });
    }

    showNotification(message, type) {
        const alertClass = type === 'success' ? 'alert-success' : 'alert-danger';
        const notification = document.createElement('div');
        notification.className = `alert ${alertClass} alert-dismissible fade show position-fixed`;
        notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }
}

// 初始化应用
const analyzer = new BinlogAnalyzer();