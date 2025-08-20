class BinlogAnalyzer {
    constructor() {
        this.operations = [];
        this.filteredOperations = [];
        this.currentPage = 1;
        this.pageSize = 50; // 每页显示50条
        this.currentSort = { field: 'timestamp', order: 'desc' }; // 默认按时间倒序
        this.timeFilterEnabled = false; // 时间筛选默认禁用
        this.minTimestamp = null;
        this.maxTimestamp = null;
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
        document.getElementById('sortBy').addEventListener('change', (e) => {
            this.currentSort.field = e.target.value;
            this.applyFilters();
        });
        
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
                if (this.timeFilterEnabled) {
                    setTimeout(() => this.applyFilters(), 100);
                }
            },
            onChange: () => {
                if (this.timeFilterEnabled) {
                    setTimeout(() => this.applyFilters(), 100);
                }
            }
        };

        this.startTimePicker = flatpickr('#startTime', pickerConfig);
        this.endTimePicker = flatpickr('#endTime', pickerConfig);
        
        // 添加手动输入监听
        document.getElementById('startTime').addEventListener('blur', () => {
            if (this.timeFilterEnabled) {
                setTimeout(() => this.applyFilters(), 100);
            }
        });
        
        document.getElementById('endTime').addEventListener('blur', () => {
            if (this.timeFilterEnabled) {
                setTimeout(() => this.applyFilters(), 100);
            }
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

        const uploadSection = document.getElementById('uploadSection');
        
        // 创建或获取进度文本元素
        let progressText = document.querySelector('.progress-text');
        if (!progressText) {
            progressText = document.createElement('div');
            progressText.className = 'progress-text text-center mt-3 mb-2';
            document.querySelector('.card-body').appendChild(progressText);
        }
        
        // 创建或获取进度详情元素
        let progressDetails = document.querySelector('.progress-details');
        if (!progressDetails) {
            progressDetails = document.createElement('div');
            progressDetails.className = 'progress-details text-center text-muted small mt-2';
            document.querySelector('.card-body').appendChild(progressDetails);
        }
        
        // 隐藏上传区域，显示解析状态
        const uploadArea = document.getElementById('uploadArea');
        if (uploadArea) {
            uploadArea.style.display = 'none';
        }
        // 显示机器猫图标
        const doraemonIcon = document.getElementById('doraemonIcon');
        if (doraemonIcon) {
            doraemonIcon.classList.remove('d-none');
        }
        if (progressText) {
            progressText.textContent = '正在上传文件...';
        }
        if (progressDetails) {
            progressDetails.textContent = '初始化中...';
        }

        let eventSource = null;
        let uploadProgress = 0;
        let isUploadComplete = false;
        
        try {
            
            // 生成临时会话 ID 用于 SSE 连接
            const tempSessionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
            
            // 先建立 SSE 连接
            console.log('建立 SSE 连接:', tempSessionId);
            eventSource = new EventSource(`/progress/${tempSessionId}`);
            
            eventSource.onopen = () => {
                console.log('SSE 连接已建立');
            };
            
            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('收到进度更新:', data);
                    if (data.type !== 'connected') {
                        this.updateProgress(data, null, null, progressText, progressDetails);
                    }
                } catch (error) {
                    console.error('解析进度数据失败:', error);
                }
            };
            
            eventSource.onerror = (error) => {
                console.error('SSE 连接错误:', error);
            };
            
            // 初始上传进度模拟
            const uploadInterval = setInterval(() => {
                if (!isUploadComplete && progressDetails) {
                    uploadProgress += Math.random() * 5;
                    if (uploadProgress > 15) {
                        uploadProgress = 15;
                    }
                    progressDetails.textContent = `上传进度: ${uploadProgress.toFixed(1)}%`;
                }
            }, 200);
            
            // 在 formData 中添加 progressSessionId
            formData.append('progressSessionId', tempSessionId);

            const startTime = Date.now();
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            // 标记上传完成，开始解析阶段
            isUploadComplete = true;
            clearInterval(uploadInterval);
            
            // 显示上传完成，开始解析
            if (progressText) {
                progressText.textContent = '上传完成，开始解析...';
            }
            if (progressDetails) {
                progressDetails.textContent = '正在解析binlog文件...';
            }
            
            const result = await response.json();
            const endTime = Date.now();
            const duration = ((endTime - startTime) / 1000).toFixed(1);

            if (result.success) {
                
                        // 等待 SSE 推送完成消息，或者超时后显示最终结果
                setTimeout(() => {
                    if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
                        if (progressText) {
                            progressText.textContent = '解析完成！';
                        }
                        if (progressDetails) {
                            progressDetails.textContent = `成功解析 ${result.total.toLocaleString()} 个操作，耗时 ${duration} 秒`;
                        }
                        eventSource.close();
                        
                        // 隐藏解析状态，显示结果
                        setTimeout(() => {
                            const doraemonIcon = document.getElementById('doraemonIcon');
                            if (doraemonIcon) {
                                doraemonIcon.classList.add('d-none');
                            }
                        }, 2000);
                    }
                }, 8000);
                
                this.operations = result.operations;
                this.sessionId = result.sessionId; // 保存 sessionId 用于后续分页查询
                this.displayResults();
                
                // 上传成功后隐藏上传区域，使页面更美观
                this.hideUploadSection();
                
                let message = `文件解析成功！耗时 ${duration} 秒，找到 ${result.total} 个操作`;
                if (result.memoryUsage) {
                    message += `，内存使用 ${result.memoryUsage.heapUsed} MB`;
                }
                
                this.showNotification(message, 'success');
            } else {
                if (progressText) {
                    progressText.textContent = '解析失败';
                }
                if (progressDetails) {
                    progressDetails.textContent = result.error;
                }
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
            // 关闭 SSE 连接
            if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
                eventSource.close();
            }
        }
    }

    async displayResults() {
        // 显示统计信息
        await this.displayStatistics();
        
        // 填充筛选选项
        this.populateFilters();
        
        // 从数据库获取真实的时间范围
        await this.setTimeRangeFromDatabase();
        
        // 使用后端分页 API 显示操作列表
        await this.loadOperationsFromServer();
        
        // 显示相关区域
        document.getElementById('statsSection').classList.remove('d-none');
        document.getElementById('filterSection').classList.remove('d-none');
        document.getElementById('operationsSection').classList.remove('d-none');
    }

    async setTimeRangeFromDatabase() {
        try {
            const response = await fetch('/time-range', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ sessionId: this.sessionId })
            });
            
            const result = await response.json();
            
            if (result.success && result.minTime && result.maxTime) {
                this.minTimestamp = new Date(result.minTime);
                this.maxTimestamp = new Date(result.maxTime);
                
                console.log('从数据库获取的时间范围:');
                console.log('最小时间:', this.formatDateTime(this.minTimestamp));
                console.log('最大时间:', this.formatDateTime(this.maxTimestamp));
                
                // 设置默认时间值
                if (this.startTimePicker) {
                    this.startTimePicker.setDate(this.minTimestamp, false);
                    document.getElementById('startTime').value = this.formatDateTimeForInput(this.minTimestamp);
                }
                
                if (this.endTimePicker) {
                    this.endTimePicker.setDate(this.maxTimestamp, false);
                    document.getElementById('endTime').value = this.formatDateTimeForInput(this.maxTimestamp);
                }
                
                // 更新placeholder显示时间范围
                document.getElementById('startTime').placeholder = `最早: ${this.formatDateTime(this.minTimestamp)}`;
                document.getElementById('endTime').placeholder = `最晚: ${this.formatDateTime(this.maxTimestamp)}`;
            } else {
                console.log('无法从数据库获取时间范围，使用默认方法');
                this.setDefaultTimeRange();
            }
        } catch (error) {
            console.error('获取时间范围失败:', error);
            this.setDefaultTimeRange();
        }
    }
    
    setDefaultTimeRange() {
        if (this.operations.length === 0) return;
        
        // 获取所有有效的时间戳
        const timestamps = this.operations
            .map(op => this.parseTimestamp(op.timestamp))
            .filter(t => t !== null)
            .sort((a, b) => a - b);
        
        if (timestamps.length > 0) {
            this.minTimestamp = timestamps[0];
            this.maxTimestamp = timestamps[timestamps.length - 1];
            
            // 设置默认时间值
            if (this.startTimePicker) {
                this.startTimePicker.setDate(this.minTimestamp, false);
                document.getElementById('startTime').value = this.formatDateTimeForInput(this.minTimestamp);
            }
            
            if (this.endTimePicker) {
                this.endTimePicker.setDate(this.maxTimestamp, false);
                document.getElementById('endTime').value = this.formatDateTimeForInput(this.maxTimestamp);
            }
            
            // 更新placeholder显示时间范围
            document.getElementById('startTime').placeholder = `最早: ${this.formatDateTime(this.minTimestamp)}`;
            document.getElementById('endTime').placeholder = `最晚: ${this.formatDateTime(this.maxTimestamp)}`;
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

    formatDateTimeForInput(date) {
        // 格式化为 flatpickr 输入格式 YYYY-MM-DD HH:mm:SS
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
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

    async populateFilters() {
        try {
            const response = await fetch('/filter-options', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ sessionId: this.sessionId })
            });
            
            const options = await response.json();
            
            const databaseFilter = document.getElementById('databaseFilter');
            const tableFilter = document.getElementById('tableFilter');

            // 清空现有选项
            databaseFilter.innerHTML = '<option value="">全部</option>';
            tableFilter.innerHTML = '<option value="">全部</option>';

            // 添加数据库选项
            if (options.databases) {
                options.databases.forEach(db => {
                    const option = document.createElement('option');
                    option.value = db;
                    option.textContent = db;
                    databaseFilter.appendChild(option);
                });
            }

            // 添加表选项
            if (options.tables) {
                options.tables.forEach(table => {
                    const option = document.createElement('option');
                    option.value = table;
                    option.textContent = table;
                    tableFilter.appendChild(option);
                });
            }
        } catch (error) {
            console.error('获取筛选选项失败:', error);
            // 降级到使用本地数据
            this.populateFiltersFromLocal();
        }
    }
    
    populateFiltersFromLocal() {
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

    async applyFilters() {
        // 重置到第一页
        this.currentPage = 1;
        await this.loadOperationsFromServer();
    }
    
    async loadOperationsFromServer() {
        // 显示加载状态
        this.showLoadingState(true);
        
        try {
            const typeFilter = document.getElementById('typeFilter').value;
            const databaseFilter = document.getElementById('databaseFilter').value;
            const tableFilter = document.getElementById('tableFilter').value;
            
            // 获取时间值（只在启用时间筛选时使用）
            let startTime = '';
            let endTime = '';
            
            if (this.timeFilterEnabled) {
                startTime = document.getElementById('startTime').value;
                endTime = document.getElementById('endTime').value;
                console.log('时间筛选已启用:', { startTime, endTime });
            }
            
            const requestData = {
                sessionId: this.sessionId,
                page: this.currentPage,
                pageSize: this.pageSize,
                sortBy: this.currentSort.field,
                sortOrder: this.currentSort.order,
                filters: {
                    type: typeFilter,
                    database: databaseFilter,
                    table: tableFilter,
                    startTime: startTime,
                    endTime: endTime
                }
            };
            
            console.log('发送查询请求:', requestData);
            
            const response = await fetch('/operations/query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });
            
            const result = await response.json();
            console.log('查询结果:', result);
            
            if (result.success) {
                this.filteredOperations = result.operations;
                this.totalOperations = result.total;
                this.totalPages = result.totalPages;
                
                this.displayOperations();
                this.updateFilterSummary();
            } else {
                console.error('加载操作失败:', result.error);
                this.showNotification('加载操作失败: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('请求失败:', error);
            this.showNotification('请求失败: ' + error.message, 'error');
        } finally {
            // 隐藏加载状态
            this.showLoadingState(false);
        }
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

    toggleTimeFilter() {
        this.timeFilterEnabled = !this.timeFilterEnabled;
        const button = document.getElementById('timeFilterToggle');
        const startTimeInput = document.getElementById('startTime');
        const endTimeInput = document.getElementById('endTime');
        
        if (this.timeFilterEnabled) {
            button.className = 'btn btn-success';
            button.innerHTML = '<i class="fas fa-check-circle"></i> 时间筛选已启用';
            this.showNotification('时间筛选已启用，当前时间范围将生效', 'success');
        } else {
            button.className = 'btn btn-outline-secondary';
            button.innerHTML = '<i class="fas fa-clock"></i> 启用时间筛选';
            this.showNotification('时间筛选已禁用，显示全部时间范围', 'success');
        }
        
        this.applyFilters();
    }

    resetTimeRange() {
        if (this.minTimestamp && this.maxTimestamp) {
            if (this.startTimePicker) {
                this.startTimePicker.setDate(this.minTimestamp, false);
            }
            if (this.endTimePicker) {
                this.endTimePicker.setDate(this.maxTimestamp, false);
            }
            this.showNotification('时间范围已重置为记录的最小/最大时间', 'success');
            if (this.timeFilterEnabled) {
                this.applyFilters();
            }
        }
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
        // 时间范围元素已在HTML中定义，直接返回
        return document.getElementById('timeRange');
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
        
        const totalItems = this.totalOperations || this.filteredOperations.length;
        const totalPages = this.totalPages || Math.ceil(totalItems / this.pageSize);
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = Math.min(startIndex + this.filteredOperations.length, startIndex + this.pageSize);
        
        // 更新计数显示
        filteredCount.innerHTML = `
            <div class="d-flex justify-content-end align-items-center gap-3">
                <span>${totalItems.toLocaleString()} 条记录</span>
                <div class="d-flex align-items-center gap-2">
                    <span class="text-muted">每页</span>
                    <select class="form-select form-select-sm" style="width: 65px;" onchange="analyzer.changePageSize(this.value)">
                        <option value="50" ${this.pageSize === 50 ? 'selected' : ''}>50</option>
                        <option value="100" ${this.pageSize === 100 ? 'selected' : ''}>100</option>
                        <option value="200" ${this.pageSize === 200 ? 'selected' : ''}>200</option>
                        <option value="500" ${this.pageSize === 500 ? 'selected' : ''}>500</option>
                        <option value="1000" ${this.pageSize === 1000 ? 'selected' : ''}>1000</option>
                    </select>
                </div>
                ${totalPages > 1 ? `<span class="text-muted">第 ${this.currentPage}/${totalPages} 页 (显示 ${startIndex + 1}-${endIndex})</span>` : ''}
            </div>
        `;

        this.filteredOperations.forEach((op, pageIndex) => {
            const row = document.createElement('tr');
            row.className = `operation-${op.type.toLowerCase()}`;
            
            const formattedTime = this.formatTimestamp(op.timestamp);
            
            const transactionId = op.xid ? `Xid:${op.xid}` : (op.gtid ? `GTID:${op.gtid}` : 'N/A');
            
            row.innerHTML = `
                <td>${formattedTime}</td>
                <td>
                    <span class="badge bg-${this.getTypeBadgeColor(op.type)}">${op.type}</span>
                </td>
                <td>${op.database}</td>
                <td>${op.table}</td>
                <td><small>${transactionId}</small></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="analyzer.showOperationDetails(${pageIndex})">
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

        // 更强大的字段值提取函数，支持引号、特殊字符等
        const extractFieldValues = (sql) => {
            const fieldValues = new Map();
            // 匹配 field = value 模式，支持引号包围的值
            const patterns = [
                /(\w+)\s*=\s*'([^']*)'/g,  // 单引号字符串
                /(\w+)\s*=\s*"([^"]*)"/g,  // 双引号字符串
                /(\w+)\s*=\s*([^,\s)]+)/g   // 无引号值
            ];
            
            patterns.forEach(pattern => {
                let match;
                while ((match = pattern.exec(sql)) !== null) {
                    const field = match[1].trim();
                    const value = match[2].trim();
                    if (!fieldValues.has(field)) {
                        fieldValues.set(field, value);
                    }
                }
            });
            
            return fieldValues;
        };

        const originalFields = extractFieldValues(originalSQL);
        const reverseFields = extractFieldValues(reverseSQL);

        let highlightedOriginal = originalSQL;
        let highlightedReverse = reverseSQL;

        // 找出所有不同的字段值对
        const differentFields = new Set();
        
        originalFields.forEach((value, field) => {
            const reverseValue = reverseFields.get(field);
            if (reverseValue && value !== reverseValue) {
                differentFields.add(field);
            }
        });
        
        reverseFields.forEach((value, field) => {
            const originalValue = originalFields.get(field);
            if (originalValue && value !== originalValue) {
                differentFields.add(field);
            }
        });

        // 高亮不同的值
        differentFields.forEach(field => {
            const originalValue = originalFields.get(field);
            const reverseValue = reverseFields.get(field);
            
            if (originalValue && reverseValue && originalValue !== reverseValue) {
                // 高亮原始SQL中的值（绿色背景）
                const originalPatterns = [
                    new RegExp(`(${this.escapeRegex(field)}\\s*=\\s*')${this.escapeRegex(originalValue)}(')`,'gi'),
                    new RegExp(`(${this.escapeRegex(field)}\\s*=\\s*")${this.escapeRegex(originalValue)}(")`,'gi'),
                    new RegExp(`(${this.escapeRegex(field)}\\s*=\\s*)${this.escapeRegex(originalValue)}(?=[,\\s)]|$)`,'gi')
                ];
                
                originalPatterns.forEach(pattern => {
                    highlightedOriginal = highlightedOriginal.replace(pattern, 
                        (match, p1, p2) => `${p1}<span style="background-color: #d4edda; color: #155724; padding: 2px 4px; border-radius: 3px; font-weight: bold; border: 1px solid #c3e6cb;">${originalValue}</span>${p2 || ''}`);
                });
                
                // 高亮回滚SQL中的值（红色背景）
                const reversePatterns = [
                    new RegExp(`(${this.escapeRegex(field)}\\s*=\\s*')${this.escapeRegex(reverseValue)}(')`,'gi'),
                    new RegExp(`(${this.escapeRegex(field)}\\s*=\\s*")${this.escapeRegex(reverseValue)}(")`,'gi'),
                    new RegExp(`(${this.escapeRegex(field)}\\s*=\\s*)${this.escapeRegex(reverseValue)}(?=[,\\s)]|$)`,'gi')
                ];
                
                reversePatterns.forEach(pattern => {
                    highlightedReverse = highlightedReverse.replace(pattern, 
                        (match, p1, p2) => `${p1}<span style="background-color: #f8d7da; color: #721c24; padding: 2px 4px; border-radius: 3px; font-weight: bold; border: 1px solid #f5c6cb;">${reverseValue}</span>${p2 || ''}`);
                });
            }
        });

        return {
            original: highlightedOriginal,
            reverse: highlightedReverse
        };
    }

    // 转义正则表达式特殊字符
    escapeRegex(string) {
        if (!string) return '';
        return string.toString().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // 排序方法
    sortBy(field, order) {
        this.currentSort = { field: field, order: order };
        this.currentPage = 1; // 重置到第一页
        
        // 更新下拉框选中状态
        document.getElementById('sortBy').value = field;
        
        const fieldNames = {
            'timestamp': '时间',
            'type': '类型',
            'database_name': '数据库',
            'table_name': '表名'
        };
        
        this.showNotification(`已按${fieldNames[field] || field}${order === 'asc' ? '正序' : '倒序'}排列`, 'success');
        this.applyFilters();
    }

    // 分页方法
    async goToPage(page) {
        if (page >= 1 && page <= this.totalPages) {
            this.currentPage = page;
            await this.loadOperationsFromServer();
        }
    }

    async changePageSize(size) {
        this.pageSize = parseInt(size);
        this.currentPage = 1;
        await this.loadOperationsFromServer();
    }

    showOperationDetails(index) {
        const operation = this.filteredOperations[index];
        
        // 高亮SQL差异
        const highlightedSQL = this.highlightSQLDifferences(operation.originalSQL, operation.reverseSQL);
        
        let modalContent = `
            <div class="modal fade" id="operationModal" tabindex="-1">
                <div class="modal-dialog modal-xl">
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
                                    <strong>事务ID:</strong> ${operation.xid ? `Xid:${operation.xid}` : (operation.gtid ? `GTID:${operation.gtid}` : 'N/A')}
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
                                                <code style="white-space: pre-wrap; word-break: break-word; overflow-wrap: break-word;">${highlightedSQL.original}</code>
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
                                                <code style="white-space: pre-wrap; word-break: break-word; overflow-wrap: break-word;">${highlightedSQL.reverse}</code>
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
        // 简化版本，只更新文本信息
        if (progressText) {
            progressText.textContent = data.stage || data.message || '处理中...';
        }
        if (progressDetails) {
            progressDetails.textContent = data.message || '';
        }
        
        // 处理完成状态
        if (data.type === 'complete') {
            setTimeout(() => {
                const doraemonIcon = document.getElementById('doraemonIcon');
                if (doraemonIcon) {
                    doraemonIcon.classList.add('d-none');
                }
            }, 2000);
        }
    }

    showLoadingState(show) {
        const operationsTable = document.getElementById('operationsTable');
        const paginationContainer = document.getElementById('paginationContainer');
        
        if (show) {
            // 显示加载状态
            operationsTable.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">加载中...</span>
                        </div>
                        <div class="mt-2">正在查询数据...</div>
                    </td>
                </tr>
            `;
            if (paginationContainer) {
                paginationContainer.innerHTML = '';
            }
        }
    }
    
    clearAllFilters() {
        // 清空筛选条件
        document.getElementById('typeFilter').value = '';
        document.getElementById('databaseFilter').value = '';
        document.getElementById('tableFilter').value = '';
        
        // 禁用时间筛选
        this.timeFilterEnabled = false;
        const button = document.getElementById('timeFilterToggle');
        button.className = 'btn btn-outline-secondary';
        button.innerHTML = '<i class="fas fa-clock"></i> 启用时间筛选';
        
        // 重置排序
        this.currentSort = { field: 'timestamp', order: 'desc' };
        this.currentPage = 1;
        
        this.showNotification('已清空所有筛选条件', 'success');
        this.applyFilters();
    }
    
    hideUploadSection() {
        const uploadSection = document.querySelector('.row.mb-4');
        if (uploadSection && uploadSection.querySelector('#uploadArea')) {
            uploadSection.style.transition = 'all 0.5s ease';
            uploadSection.style.transform = 'translateY(-20px)';
            uploadSection.style.opacity = '0';
            
            setTimeout(() => {
                uploadSection.style.display = 'none';
                // 滚动到统计信息区域
                const statsSection = document.getElementById('statsSection');
                if (statsSection) {
                    statsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 500);
        }
    }
    

    
    showUploadSection() {
        const uploadSection = document.querySelector('.row.mb-4');
        if (uploadSection) {
            // 重置上传区域状态
            const doraemonIcon = document.getElementById('doraemonIcon');
            const progressContainer = document.getElementById('uploadProgress');
            const fileInput = document.getElementById('fileInput');
            const uploadArea = document.getElementById('uploadArea');
            
            // 隐藏解析中图标和进度条
            if (doraemonIcon) {
                doraemonIcon.classList.add('d-none');
            }
            if (progressContainer) {
                progressContainer.classList.add('d-none');
            }
            // 显示上传区域
            if (uploadArea) {
                uploadArea.style.display = 'block';
            }
            // 清空文件选择
            if (fileInput) {
                fileInput.value = '';
            }
            
            uploadSection.style.display = 'block';
            uploadSection.style.opacity = '0';
            uploadSection.style.transform = 'translateY(-20px)';
            
            setTimeout(() => {
                uploadSection.style.transition = 'all 0.5s ease';
                uploadSection.style.opacity = '1';
                uploadSection.style.transform = 'translateY(0)';
                uploadSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 50);
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