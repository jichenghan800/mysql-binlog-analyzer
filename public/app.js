class BinlogAnalyzer {
    constructor() {
        this.operations = [];
        this.filteredOperations = [];
        this.currentPage = 1;
        this.pageSize = 100; // 每页显示100条
        this.currentSort = { field: 'timestamp', order: 'desc' }; // 默认按时间倒序
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
        
        // 初始化时间选择器
        this.initializeDatePickers();
    }

    initializeDatePickers() {
        // 初始化flatpickr时间选择器
        const pickerConfig = {
            enableTime: true,
            enableSeconds: true,
            dateFormat: 'Y-m-d H:i:S',
            time_24hr: true,
            locale: 'zh',
            allowInput: true,
            clickOpens: true,
            minuteIncrement: 1,
            secondIncrement: 1,
            defaultHour: 0,
            defaultMinute: 0,
            onClose: () => {
                // 延迟执行筛选，确保值已更新
                setTimeout(() => this.applyFilters(), 100);
            },
            onChange: () => {
                // 延迟执行筛选，确保值已更新
                setTimeout(() => this.applyFilters(), 100);
            },
            onOpen: (selectedDates, dateStr, instance) => {
                // 打开时设置为binlog时间范围
                if (this.operations.length > 0 && selectedDates.length === 0) {
                    const timestamps = this.operations
                        .map(op => this.parseTimestamp(op.timestamp))
                        .filter(t => t !== null)
                        .sort((a, b) => a - b);
                    
                    if (timestamps.length > 0) {
                        const isStartPicker = instance.element.id === 'startTime';
                        const defaultTime = isStartPicker ? timestamps[0] : timestamps[timestamps.length - 1];
                        instance.setDate(defaultTime, false); // false = 不触发onChange
                    }
                }
            }
        };

        this.startTimePicker = flatpickr('#startTime', pickerConfig);
        this.endTimePicker = flatpickr('#endTime', pickerConfig);
        
        // 添加手动输入监听
        document.getElementById('startTime').addEventListener('blur', () => {
            setTimeout(() => this.applyFilters(), 100);
        });
        
        document.getElementById('endTime').addEventListener('blur', () => {
            setTimeout(() => this.applyFilters(), 100);
        });
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
        const uploadSection = document.getElementById('uploadSection');
        
        // 获取进度条元素
        const progressOverlay = document.getElementById('progressOverlay');
        
        // 创建或获取进度文本元素
        let progressText = document.querySelector('#uploadProgress .progress-text');
        if (!progressText) {
            progressText = document.createElement('div');
            progressText.className = 'progress-text text-center mt-3 mb-2';
            progressContainer.appendChild(progressText);
        }
        
        // 创建或获取进度详情元素
        let progressDetails = document.querySelector('#uploadProgress .progress-details');
        if (!progressDetails) {
            progressDetails = document.createElement('div');
            progressDetails.className = 'progress-details text-center text-muted small mt-2';
            progressContainer.appendChild(progressDetails);
        }
        
        // 隐藏上传区域，显示进度条
        if (uploadSection) {
            uploadSection.style.display = 'none';
        }
        progressContainer.classList.remove('d-none');
        progressBar.style.width = '0%';
        progressOverlay.textContent = '0%';
        progressText.textContent = '正在上传文件...';
        progressDetails.textContent = '初始化中...';

        try {
            let eventSource = null;
            let uploadProgress = 0;
            
            // 初始上传进度模拟
            const uploadInterval = setInterval(() => {
                uploadProgress += Math.random() * 8;
                if (uploadProgress > 20) {
                    uploadProgress = 20;
                    clearInterval(uploadInterval);
                }
                progressBar.style.width = uploadProgress + '%';
                progressOverlay.textContent = uploadProgress.toFixed(1) + '%';
                progressDetails.textContent = `上传进度: ${uploadProgress.toFixed(1)}%`;
            }, 200);

            const startTime = Date.now();
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            clearInterval(uploadInterval);
            
            const result = await response.json();
            const endTime = Date.now();
            const duration = ((endTime - startTime) / 1000).toFixed(1);

            if (result.success) {
                // 建立 SSE 连接接收实时进度
                if (result.progressSessionId) {
                    eventSource = new EventSource(`/progress/${result.progressSessionId}`);
                    
                    eventSource.onmessage = (event) => {
                        try {
                            const data = JSON.parse(event.data);
                            this.updateProgress(data, progressBar, progressOverlay, progressText, progressDetails);
                        } catch (error) {
                            console.error('解析进度数据失败:', error);
                        }
                    };
                    
                    eventSource.onerror = (error) => {
                        console.error('SSE 连接错误:', error);
                        eventSource.close();
                    };
                }
                
                // 显示最终结果
                setTimeout(() => {
                    progressBar.style.width = '100%';
                    progressOverlay.textContent = '100%';
                    progressText.textContent = '解析完成！';
                    progressDetails.textContent = `成功解析 ${result.total.toLocaleString()} 个操作，耗时 ${duration} 秒`;
                    
                    if (eventSource) {
                        eventSource.close();
                    }
                }, 1000);
                
                this.operations = result.operations;
                this.displayResults();
                
                let message = `文件解析成功！耗时 ${duration} 秒，找到 ${result.total} 个操作`;
                if (result.memoryUsage) {
                    message += `，内存使用 ${result.memoryUsage.heapUsed} MB`;
                }
                
                this.showNotification(message, 'success');
            } else {
                progressBar.style.width = '100%';
                progressOverlay.textContent = '失败';
                progressText.textContent = '解析失败';
                progressDetails.textContent = result.error;
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
                if (uploadSection) {
                    uploadSection.style.display = 'block';
                }
            }, 3000);
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
            
            // 设置flatpickr的最小和最大日期
            if (this.startTimePicker) {
                this.startTimePicker.set('minDate', earliest);
                this.startTimePicker.set('maxDate', latest);
                this.startTimePicker.clear();
            }
            
            if (this.endTimePicker) {
                this.endTimePicker.set('minDate', earliest);
                this.endTimePicker.set('maxDate', latest);
                this.endTimePicker.clear();
            }
            
            // 更新placeholder
            document.getElementById('startTime').placeholder = `最早: ${this.formatDateTime(earliest)}`;
            document.getElementById('endTime').placeholder = `最晚: ${this.formatDateTime(latest)}`;
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
        
        // 获取时间值，优先使用flatpickr的值
        let startTime = '';
        let endTime = '';
        
        if (this.startTimePicker && this.startTimePicker.selectedDates.length > 0) {
            startTime = this.startTimePicker.formatDate(this.startTimePicker.selectedDates[0], 'Y-m-d H:i:S');
        } else {
            startTime = document.getElementById('startTime').value;
        }
        
        if (this.endTimePicker && this.endTimePicker.selectedDates.length > 0) {
            endTime = this.endTimePicker.formatDate(this.endTimePicker.selectedDates[0], 'Y-m-d H:i:S');
        } else {
            endTime = document.getElementById('endTime').value;
        }
        
        console.log('Time filter:', { startTime, endTime }); // 调试日志

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
                
                if (startTime && startTime.trim()) {
                    // 支持秒级精度的时间比较
                    const start = new Date(startTime);
                    if (isNaN(start.getTime())) {
                        console.warn('无效的开始时间:', startTime);
                    } else if (opTime.getTime() < start.getTime()) {
                        return false;
                    }
                }
                
                if (endTime && endTime.trim()) {
                    // 支持秒级精度的时间比较
                    const end = new Date(endTime);
                    if (isNaN(end.getTime())) {
                        console.warn('无效的结束时间:', endTime);
                    } else if (opTime.getTime() > end.getTime()) {
                        return false;
                    }
                }
            }
            
            return true;
        });

        // 应用排序
        this.filteredOperations.sort((a, b) => {
            let result = 0;
            
            switch (this.currentSort.field) {
                case 'timestamp':
                    const timeA = this.parseTimestamp(a.timestamp);
                    const timeB = this.parseTimestamp(b.timestamp);
                    result = (timeA || new Date(0)) - (timeB || new Date(0));
                    break;
                case 'type':
                    result = a.type.localeCompare(b.type);
                    break;
                case 'database':
                    result = a.database.localeCompare(b.database);
                    break;
                case 'table':
                    result = a.table.localeCompare(b.table);
                    break;
                default:
                    // 兼容旧的sortBy选择器
                    switch (sortBy) {
                        case 'timestamp':
                            const timeA2 = this.parseTimestamp(a.timestamp);
                            const timeB2 = this.parseTimestamp(b.timestamp);
                            result = (timeA2 || new Date(0)) - (timeB2 || new Date(0));
                            break;
                        case 'type':
                            result = a.type.localeCompare(b.type);
                            break;
                        case 'database':
                            result = a.database.localeCompare(b.database);
                            break;
                        case 'table':
                            result = a.table.localeCompare(b.table);
                            break;
                        default:
                            result = 0;
                    }
            }
            
            // 应用排序方向
            return this.currentSort.order === 'desc' ? -result : result;
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
        if (this.startTimePicker) {
            this.startTimePicker.clear();
        }
        if (this.endTimePicker) {
            this.endTimePicker.clear();
        }
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
                // 使用binlog最早时间的当天开始
                const binlogDay = new Date(earliest);
                binlogDay.setHours(0, 0, 0, 0);
                startTime = binlogDay;
                // 使用binlog最晚时间或当天结束
                const dayEnd = new Date(binlogDay);
                dayEnd.setHours(23, 59, 59, 999);
                endTime = latest < dayEnd ? latest : dayEnd;
                break;
            case 'earliest':
                // 新增：默认为binlog最早时间
                startTime = earliest;
                endTime = null;
                break;
            case 'latest':
                // 新增：默认为binlog最晚时间
                startTime = null;
                endTime = latest;
                break;
            default:
                return;
        }
        
        if (startTime && this.startTimePicker) {
            this.startTimePicker.setDate(startTime);
        }
        if (endTime && this.endTimePicker) {
            this.endTimePicker.setDate(endTime);
        }
        
        // 如果只设置了开始或结束时间，清空另一个
        if (startTime && !endTime && this.endTimePicker) {
            this.endTimePicker.clear();
        }
        if (endTime && !startTime && this.startTimePicker) {
            this.startTimePicker.clear();
        }
        
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
        
        // 计算分页
        const totalItems = this.filteredOperations.length;
        const totalPages = Math.ceil(totalItems / this.pageSize);
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = Math.min(startIndex + this.pageSize, totalItems);
        const currentPageData = this.filteredOperations.slice(startIndex, endIndex);
        
        // 更新计数显示
        filteredCount.innerHTML = `
            <div class="d-flex align-items-center gap-3">
                <span>${totalItems} 条记录</span>
                <div class="d-flex align-items-center gap-2">
                    <label class="form-label mb-0 small">每页:</label>
                    <select class="form-select form-select-sm" style="width: 80px;" onchange="analyzer.changePageSize(this.value)">
                        <option value="50" ${this.pageSize === 50 ? 'selected' : ''}>50</option>
                        <option value="100" ${this.pageSize === 100 ? 'selected' : ''}>100</option>
                        <option value="200" ${this.pageSize === 200 ? 'selected' : ''}>200</option>
                        <option value="500" ${this.pageSize === 500 ? 'selected' : ''}>500</option>
                        <option value="${totalItems}" ${this.pageSize >= totalItems ? 'selected' : ''}>全部</option>
                    </select>
                </div>
                ${totalPages > 1 ? `<span class="small text-muted">第 ${this.currentPage}/${totalPages} 页 (显示 ${startIndex + 1}-${endIndex})</span>` : ''}
            </div>
        `;

        currentPageData.forEach((op, pageIndex) => {
            const globalIndex = startIndex + pageIndex; // 全局索引
            const row = document.createElement('tr');
            row.className = `operation-${op.type.toLowerCase()}`;
            
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
                    <button class="btn btn-sm btn-outline-primary" onclick="analyzer.showOperationDetails(${globalIndex})">
                        <i class="fas fa-eye"></i> 查看详情
                    </button>
                </td>
            `;
            
            tbody.appendChild(row);
        });
        
        // 添加分页导航
        this.renderPagination(totalPages);
    }
    
    renderPagination(totalPages) {
        if (totalPages <= 1) return;
        
        let paginationHtml = `
            <nav class="mt-3">
                <ul class="pagination justify-content-center">
                    <li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}">
                        <button class="page-link" onclick="analyzer.goToPage(${this.currentPage - 1})">上一页</button>
                    </li>
        `;
        
        // 显示页码
        const maxVisiblePages = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        if (startPage > 1) {
            paginationHtml += `<li class="page-item"><button class="page-link" onclick="analyzer.goToPage(1)">1</button></li>`;
            if (startPage > 2) {
                paginationHtml += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            paginationHtml += `
                <li class="page-item ${i === this.currentPage ? 'active' : ''}">
                    <button class="page-link" onclick="analyzer.goToPage(${i})">${i}</button>
                </li>
            `;
        }
        
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHtml += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            }
            paginationHtml += `<li class="page-item"><button class="page-link" onclick="analyzer.goToPage(${totalPages})">${totalPages}</button></li>`;
        }
        
        paginationHtml += `
                    <li class="page-item ${this.currentPage === totalPages ? 'disabled' : ''}">
                        <button class="page-link" onclick="analyzer.goToPage(${this.currentPage + 1})">下一页</button>
                    </li>
                </ul>
            </nav>
        `;
        
        // 添加到表格下方
        const tableContainer = document.querySelector('#operationsSection .card-body');
        let paginationContainer = document.getElementById('paginationContainer');
        if (!paginationContainer) {
            paginationContainer = document.createElement('div');
            paginationContainer.id = 'paginationContainer';
            tableContainer.appendChild(paginationContainer);
        }
        paginationContainer.innerHTML = paginationHtml;
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

    // 时间排序方法
    sortByTime(order) {
        this.currentSort = { field: 'timestamp', order: order };
        this.currentPage = 1; // 重置到第一页
        this.applyFilters();
        this.showNotification(`已按时间${order === 'asc' ? '正序' : '倒序'}排列`, 'success');
    }

    // 分页方法
    goToPage(page) {
        const totalPages = Math.ceil(this.filteredOperations.length / this.pageSize);
        if (page >= 1 && page <= totalPages) {
            this.currentPage = page;
            this.displayOperations();
        }
    }

    changePageSize(size) {
        this.pageSize = parseInt(size);
        this.currentPage = 1;
        this.displayOperations();
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
            // 创建合并的对比表格
            const allColumns = new Set();
            operation.setValues?.forEach(v => allColumns.add(v.column));
            operation.whereConditions?.forEach(w => allColumns.add(w.column));
            
            if (allColumns.size > 0) {
                const sortedColumns = Array.from(allColumns).sort((a, b) => a - b);
                
                modalContent += `
                    <h6>值变更对比:</h6>
                    <div class="table-responsive">
                        <table class="table table-sm table-bordered">
                            <thead class="table-light">
                                <tr>
                                    <th>列</th>
                                    <th class="text-danger">旧值 (WHERE)</th>
                                    <th class="text-success">新值 (SET)</th>
                                    <th>状态</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${sortedColumns.map(column => {
                                    const oldValue = operation.whereConditions?.find(w => w.column === column);
                                    const newValue = operation.setValues?.find(s => s.column === column);
                                    
                                    const oldVal = oldValue ? oldValue.value : '-';
                                    const newVal = newValue ? newValue.value : '-';
                                    const isChanged = oldVal !== newVal && oldVal !== '-' && newVal !== '-';
                                    
                                    const oldStyle = isChanged ? 'background-color: #f8d7da; font-weight: bold;' : '';
                                    const newStyle = isChanged ? 'background-color: #d4edda; font-weight: bold;' : '';
                                    const statusBadge = isChanged ? 
                                        '<span class="badge bg-warning text-dark"><i class="fas fa-exchange-alt"></i> 已变更</span>' : 
                                        '<span class="badge bg-secondary"><i class="fas fa-minus"></i> 未变更</span>';
                                    
                                    return `<tr>
                                        <td><strong>@${column}</strong></td>
                                        <td style="${oldStyle}">${oldVal}</td>
                                        <td style="${newStyle}">${newVal}</td>
                                        <td>${statusBadge}</td>
                                    </tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div class="alert alert-info py-2 mt-2">
                        <small>
                            <i class="fas fa-info-circle"></i>
                            <strong>颜色说明:</strong>
                            <span class="ms-2" style="background-color: #f8d7da; color: #721c24; padding: 2px 6px; border-radius: 3px;">红色</span> 旧值
                            <span class="ms-2" style="background-color: #d4edda; color: #155724; padding: 2px 6px; border-radius: 3px;">绿色</span> 新值
                        </small>
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

    updateProgress(data, progressBar, progressOverlay, progressText, progressDetails) {
        // 直接使用后端推送的实际进度值
        switch (data.type) {
            case 'parsing':
                // 使用后端计算的实际解析进度
                progressBar.style.width = data.progress + '%';
                progressOverlay.textContent = data.progress.toFixed(1) + '%';
                progressText.textContent = data.stage;
                progressDetails.textContent = data.message;
                break;
                
            case 'parsed':
                progressBar.style.width = '100%';
                progressOverlay.textContent = '100%';
                progressText.textContent = data.stage;
                progressDetails.textContent = data.message;
                break;
                
            case 'extracting':
                // 提取阶段保持100%
                progressBar.style.width = '100%';
                progressOverlay.textContent = '100%';
                progressText.textContent = data.stage;
                progressDetails.textContent = data.message;
                break;
                
            case 'saving':
                // 使用后端计算的实际保存进度
                progressBar.style.width = data.progress + '%';
                progressOverlay.textContent = data.progress.toFixed(1) + '%';
                progressText.textContent = data.stage;
                progressDetails.textContent = data.message;
                break;
                
            case 'complete':
                progressBar.style.width = '100%';
                progressOverlay.textContent = '100%';
                progressText.textContent = data.message;
                progressDetails.textContent = `共找到 ${data.total.toLocaleString()} 个操作`;
                break;
        }
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