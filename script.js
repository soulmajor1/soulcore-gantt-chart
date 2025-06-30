document.addEventListener('DOMContentLoaded', () => {
    const taskModal = document.getElementById('task-modal');
    const addTaskMainBtn = document.getElementById('add-task-main-btn');
    const closeBtn = document.querySelector('.close-btn');
    const saveTaskBtn = document.getElementById('save-task-btn');
    const deleteTaskBtn = document.getElementById('delete-task-btn');
    const taskForm = document.getElementById('task-form');
    const parentTaskSelect = document.getElementById('parent-task');
    const clearDataBtn = document.getElementById('clear-data');
    const gridHeader = document.getElementById('grid-header');
    const gridRowsWrapper = document.getElementById('grid-rows-wrapper');
    const ganttHeaderContainer = document.getElementById('gantt-header-container');
    const ganttHeaderMajor = document.getElementById('gantt-header-major');
    const ganttHeaderMinor = document.getElementById('gantt-header-minor');
    const ganttBodyContainer = document.getElementById('gantt-body-container');
    const ganttContentWrapper = document.getElementById('gantt-content-wrapper');
    const ganttGridLines = document.getElementById('gantt-grid-lines');
    const ganttBarsArea = document.getElementById('gantt-bars-area');
    const ganttConnectors = document.getElementById('gantt-connectors');
    const viewModeControls = document.getElementById('view-mode-controls');
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const importBtn = document.getElementById('import-btn');
    const exportBtn = document.getElementById('export-btn');
    const importMenu = document.getElementById('import-menu');
    const exportMenu = document.getElementById('export-menu');

    // Modal Form Elements
    const modalTitle = document.getElementById('modal-title');
    const taskIdInput = document.getElementById('task-id');
    const taskNameInput = document.getElementById('task-name');
    const taskTypeSelect = document.getElementById('task-type');
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const durationInput = document.getElementById('task-duration');
    const progressInput = document.getElementById('task-progress');
    const progressValue = document.getElementById('progress-value');
    const notesInput = document.getElementById('task-notes');
    const predecessorList = document.getElementById('predecessor-list');
    const addPredecessorBtn = document.getElementById('add-predecessor-btn');
    const successorList = document.getElementById('successor-list');
    const addSuccessorBtn = document.getElementById('add-successor-btn');
    const assignedToWrapper = document.getElementById('assigned-to-wrapper');
    const assignedToDisplay = document.getElementById('assigned-to-display');
    const assignedToDropdown = document.getElementById('assigned-to-dropdown');


    const ICON_COLLAPSED = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M10 17l5-5-5-5v10z"></path></svg>`;
    const ICON_EXPANDED = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5H7z"></path></svg>`;

    let tasks = [];
    let collapsedTasks = new Set();
    let columnWidths = {};
    let personnel = [];
    let currentViewMode = 'day';
    let zoomLevel = 40; // Default pixel width for one day in 'day' view.

    const loadTasks = () => {
        const storedTasks = localStorage.getItem('projectTasks');
        if (storedTasks) {
            let loadedTasks = JSON.parse(storedTasks);
            
            tasks = loadedTasks.map(task => {
                let migratedAssignedTo = [];
                if (task.assignedTo) {
                    const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
                    
                    migratedAssignedTo = assignees.map(assignee => {
                        if (typeof assignee === 'number') {
                            return personnel.find(p => p.id === assignee) ? assignee : null;
                        }
                        if (typeof assignee === 'string') {
                            const person = personnel.find(p => p.name === assignee);
                            return person ? person.id : null;
                        }
                        return null;
                    }).filter(id => id !== null);
                }
                
                return {
                    ...task,
                    assignedTo: migratedAssignedTo
                };
            });

        } else {
            // Veri yoksa, data.js'den gelen başlangıç verilerini kullan (deep copy)
            tasks = JSON.parse(JSON.stringify(initialTaskData));
        }
    };

    const saveTasks = () => {
        localStorage.setItem('projectTasks', JSON.stringify(tasks));
    };

    const getDuration = (start, end) => {
        if (!start || !end) return 0;
        const startDate = new Date(start);
        const endDate = new Date(end);
        if(isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate < startDate) return 0;
        return Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    };
    
    const renderAll = () => {
        tasks.sort((a, b) => {
            const wbsA = (a && a.wbs) ? a.wbs : '';
            const wbsB = (b && b.wbs) ? b.wbs : '';
            return wbsA.localeCompare(wbsB, undefined, { numeric: true });
        });
        
        renderSchedule();
    };
    
    const renderSchedule = () => {
        const scrollLeft = ganttBodyContainer.scrollLeft;
        const scrollTop = ganttBodyContainer.scrollTop;

        gridRowsWrapper.innerHTML = '';
        ganttHeaderMajor.innerHTML = '';
        ganttHeaderMinor.innerHTML = '';
        ganttGridLines.innerHTML = '';
        ganttBarsArea.innerHTML = '';
        ganttConnectors.innerHTML = ''; 

        const visibleTasks = tasks.filter(task => {
            let isVisible = true;
            let currentParentId = task.parentId;
            while(currentParentId !== 0) {
                if (collapsedTasks.has(currentParentId)) {
                    isVisible = false;
                    break;
                }
                const parent = tasks.find(t => t.id === currentParentId);
                currentParentId = parent ? parent.parentId : 0;
            }
            return isVisible;
        });
        
        const validTasks = visibleTasks.filter(t => t && t.startDate && t.endDate);
        if (validTasks.length === 0) return;

        const allDates = validTasks.flatMap(t => [new Date(t.startDate), new Date(t.endDate)]);
        if (allDates.length === 0) return;

        let projectStartDate = new Date(Math.min.apply(null, allDates));
        let projectEndDate = new Date(Math.max.apply(null, allDates));
        
        projectStartDate.setDate(projectStartDate.getDate() - 7);
        projectEndDate.setDate(projectEndDate.getDate() + 7);

        // --- View-based rendering ---
        let totalGanttWidth = 0;
        let pixelsPerDay = 0;
        
        const createHeaderUnit = (text, width, container) => {
            const unitDiv = document.createElement('div');
            unitDiv.className = 'gantt-header-unit';
            unitDiv.style.width = `${width}px`;
            unitDiv.textContent = text;
            container.appendChild(unitDiv);
        };
        const createGridLine = (left) => {
             const line = document.createElement('div');
             line.className = 'gantt-grid-line vertical';
             line.style.left = `${left}px`;
             ganttGridLines.appendChild(line);
        };

        if (currentViewMode === 'day') {
            pixelsPerDay = zoomLevel;
            let currentMonth = -1;
            let currentMajorUnitWidth = 0;
            let dateIterator = new Date(projectStartDate);
            while(dateIterator <= projectEndDate) {
                if (dateIterator.getMonth() !== currentMonth) {
                    if (currentMajorUnitWidth > 0) {
                       const majorUnitDate = new Date(dateIterator);
                       majorUnitDate.setMonth(majorUnitDate.getMonth()-1);
                       createHeaderUnit(majorUnitDate.toLocaleString('tr-TR', {month: 'long', year: 'numeric'}), currentMajorUnitWidth, ganttHeaderMajor);
                    }
                    currentMonth = dateIterator.getMonth();
                    currentMajorUnitWidth = 0;
                }
                createHeaderUnit(dateIterator.getDate(), zoomLevel, ganttHeaderMinor);
                createGridLine(totalGanttWidth);
                currentMajorUnitWidth += zoomLevel;
                totalGanttWidth += zoomLevel;
                dateIterator.setDate(dateIterator.getDate() + 1);
            }
             if (currentMajorUnitWidth > 0) {
                createHeaderUnit(projectEndDate.toLocaleString('tr-TR', {month: 'long', year: 'numeric'}), currentMajorUnitWidth, ganttHeaderMajor);
            }
        
        } else if (currentViewMode === 'week') {
            const weekWidth = zoomLevel * 1.5;
            pixelsPerDay = weekWidth / 7;
            let dateIterator = new Date(projectStartDate);
            while(dateIterator.getDay() !== 1) { dateIterator.setDate(dateIterator.getDate() - 1); } // Start from Monday

            while (dateIterator <= projectEndDate) {
                createHeaderUnit(`Hafta ${getWeekNumber(dateIterator)}`, weekWidth, ganttHeaderMinor);
                createGridLine(totalGanttWidth);
                totalGanttWidth += weekWidth;
                dateIterator.setDate(dateIterator.getDate() + 7);
            }
        } else if (currentViewMode === 'month') {
            const monthWidth = zoomLevel * 3.5;
            pixelsPerDay = monthWidth / 30.4375; // Average days in month
            let dateIterator = new Date(projectStartDate);
            dateIterator.setDate(1);

            while (dateIterator <= projectEndDate) {
                createHeaderUnit(dateIterator.toLocaleString('tr-TR', {month: 'long', year: 'numeric'}), monthWidth, ganttHeaderMinor);
                createGridLine(totalGanttWidth);
                totalGanttWidth += monthWidth;
                dateIterator.setMonth(dateIterator.getMonth() + 1);
            }
        } else if (currentViewMode === 'quarter') {
             const quarterWidth = zoomLevel * 7;
             pixelsPerDay = quarterWidth / 91.25;
             let dateIterator = new Date(projectStartDate);
             dateIterator.setDate(1);
             dateIterator.setMonth(Math.floor(dateIterator.getMonth() / 3) * 3);

             while(dateIterator <= projectEndDate) {
                 const year = dateIterator.getFullYear();
                 const quarter = Math.floor(dateIterator.getMonth() / 3) + 1;
                 createHeaderUnit(`${year} - Ç${quarter}`, quarterWidth, ganttHeaderMinor);
                 createGridLine(totalGanttWidth);
                 totalGanttWidth += quarterWidth;
                 dateIterator.setMonth(dateIterator.getMonth() + 3);
             }
        } else if (currentViewMode === 'year') {
            const yearWidth = zoomLevel * 15;
            pixelsPerDay = yearWidth / 365.25;
            let dateIterator = new Date(projectStartDate);
            dateIterator.setDate(1);
            dateIterator.setMonth(0);
             while(dateIterator <= projectEndDate) {
                 createHeaderUnit(dateIterator.getFullYear(), yearWidth, ganttHeaderMinor);
                 createGridLine(totalGanttWidth);
                 totalGanttWidth += yearWidth;
                 dateIterator.setFullYear(dateIterator.getFullYear() + 1);
             }
        }
        if (['week', 'month', 'quarter', 'year'].includes(currentViewMode)) {
            let dateIterator = new Date(projectStartDate);
            let currentYear = -1;
            let majorUnitText = '';
            
            while(dateIterator <= projectEndDate) {
                 const year = dateIterator.getFullYear();
                 if (year !== currentYear) {
                    if (majorUnitText) {
                         const unitEndDate = new Date(dateIterator);
                         unitEndDate.setDate(unitEndDate.getDate()-1);
                         const width = (getDuration(new Date(majorUnitText, 0, 1), unitEndDate) + 1) * pixelsPerDay;
                         createHeaderUnit(majorUnitText, width, ganttHeaderMajor);
                    }
                    currentYear = year;
                    majorUnitText = year.toString();
                 }
                dateIterator.setDate(dateIterator.getDate() + 1);
            }
             if (majorUnitText) {
                 const width = (getDuration(new Date(majorUnitText, 0, 1), projectEndDate) + 1) * pixelsPerDay;
                 createHeaderUnit(majorUnitText, width, ganttHeaderMajor);
             }
        }
        
        ganttContentWrapper.style.width = `${totalGanttWidth}px`;
        ganttConnectors.setAttribute('width', totalGanttWidth);
        ganttConnectors.setAttribute('height', '100%'); 

        let totalHeight = 0;
        const ROW_HEIGHT = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--row-height'));
        
        const taskElementMap = new Map();

        const buildRowsRecursively = (parentId = 0, level = 0) => {
            if (collapsedTasks.has(parentId)) return;

            const children = tasks.filter(task => task && task.parentId === parentId);
            children.forEach(task => {
                if(!task.startDate || !task.endDate) return;

                const nameIndent = level * 20;
                let duration = getDuration(task.startDate, task.endDate);
                if (task.type === 'milestone') duration = 0;
                const progress = task.progress || 0;
                const hasChildren = tasks.some(t => t.parentId === task.id);
                const isCollapsed = collapsedTasks.has(task.id);
                const toggleIcon = hasChildren 
                    ? `<span class="toggle-btn" data-task-id="${task.id}">${isCollapsed ? ICON_COLLAPSED : ICON_EXPANDED}</span>` 
                    : '<span class="toggle-placeholder"></span>';
                
                const assignedToHTML = (task.assignedTo || [])
                    .map(personId => {
                        const person = personnel.find(p => p.id === personId);
                        if (!person) return '';
                        return `<div class="assignee-avatar">
                                    <img src="${person.avatarUrl}" />
                                    <span class="assignee-name-tooltip">${person.name}</span>
                                </div>`;
                    })
                    .join('');

                const gridRow = document.createElement('div');
                gridRow.className = 'grid-row';
                gridRow.dataset.taskId = task.id;
                gridRow.innerHTML = `
                    <div class="grid-cell col-add"><button class="add-child-btn" data-task-id="${task.id}">+</button></div>
                    <div class="grid-cell col-wbs">${task.wbs}</div>
                    <div class="grid-cell col-name col-name-cell" data-task-id="${task.id}">
                        <span style="width: ${nameIndent}px; display: inline-block; flex-shrink: 0;"></span>
                        ${toggleIcon}
                        <span class="task-name-label" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${task.name}</span>
                    </div>
                    <div class="grid-cell col-duration">${duration} gün</div>
                    <div class="grid-cell col-start-date">${task.startDate}</div>
                    <div class="grid-cell col-end-date">${task.endDate}</div>
                    <div class="grid-cell col-assigned"><div class="assignee-avatar-stack">${assignedToHTML}</div></div>
                    <div class="grid-cell col-progress">
                        <div class="progress-bar-container">
                            <div class="progress-bar-fill" style="width: ${progress}%;">${progress}%</div>
                        </div>
                    </div>
                `;
                 if (hasChildren) {
                    gridRow.querySelector('.task-name-label').style.fontWeight = 'bold';
                }
                gridRowsWrapper.appendChild(gridRow);
                
                const hLine = document.createElement('div');
                hLine.className = 'gantt-grid-line horizontal';
                hLine.style.top = `${totalHeight + ROW_HEIGHT -1}px`;
                ganttGridLines.appendChild(hLine);

                const taskStartDate = new Date(task.startDate);
                const startOffsetDays = getDuration(projectStartDate, taskStartDate) - 1;
                const startOffsetPixels = startOffsetDays * pixelsPerDay;
                
                const ganttBar = document.createElement('div');
                ganttBar.dataset.taskId = task.id;
                
                const barTop = totalHeight + (ROW_HEIGHT / 2) - 11;
                ganttBar.style.top = `${barTop}px`;

                if (task.type === 'milestone') {
                    ganttBar.className = `gantt-bar milestone`;
                    ganttBar.style.left = `${startOffsetPixels + (pixelsPerDay/2) - 11}px`;
                    ganttBar.title = task.name;
                } else {
                    const widthPixels = Math.max(0, duration * pixelsPerDay - 2);
                    ganttBar.className = `gantt-bar ${task.parentId !== 0 ? 'sub-task' : ''}`;
                    ganttBar.style.left = `${startOffsetPixels}px`;
                    ganttBar.style.width = `${widthPixels}px`;

                    const ganttBarProgress = document.createElement('div');
                    ganttBarProgress.className = 'gantt-bar-progress';
                    ganttBarProgress.style.width = `${progress}%`;
                    ganttBar.appendChild(ganttBarProgress);

                    const barLabel = document.createElement('span');
                    barLabel.className = 'gantt-bar-label';
                    barLabel.textContent = task.name;
                    ganttBar.appendChild(barLabel);
                    
                    const resizeHandleLeft = document.createElement('div');
                    resizeHandleLeft.className = 'resize-handle left';
                    ganttBar.appendChild(resizeHandleLeft);
                    
                    const resizeHandleRight = document.createElement('div');
                    resizeHandleRight.className = 'resize-handle right';
                    ganttBar.appendChild(resizeHandleRight);
                    
                    makeBarDraggable(ganttBar, task, projectStartDate, pixelsPerDay);
                    makeBarResizable(ganttBar, resizeHandleLeft, resizeHandleRight, task, projectStartDate, pixelsPerDay);
                }
                
                ganttBarsArea.appendChild(ganttBar);
                taskElementMap.set(task.id, { bar: ganttBar, row: gridRow, top: barTop });
                totalHeight += ROW_HEIGHT;
                buildRowsRecursively(task.id, level + 1);
            });
        };
        
        buildRowsRecursively(0);
        gridRowsWrapper.style.height = `${totalHeight}px`;
        ganttContentWrapper.style.height = `${totalHeight}px`;
        ganttConnectors.setAttribute('height', totalHeight);
        
        ganttBodyContainer.scrollLeft = scrollLeft;
        ganttBodyContainer.scrollTop = scrollTop;

        applyColumnWidths();
        renderConnectors(taskElementMap);
    };

    function getWeekNumber(d) {
        d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
        var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
        var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
        return weekNo;
    }

    const renderConnectors = (taskElementMap) => {
        const ROW_HEIGHT = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--row-height'));
        const connectorColor = getComputedStyle(document.documentElement).getPropertyValue('--connector-color');
        const svgDef = `<defs><marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${connectorColor}" /></marker></defs>`;
        ganttConnectors.innerHTML = svgDef;

        tasks.forEach(task => {
            if (!task.predecessors || task.predecessors.length === 0) return;

            const endElement = taskElementMap.get(task.id);
            if (!endElement) return;

            task.predecessors.forEach(dep => {
                const startElement = taskElementMap.get(dep.taskId);
                if (!startElement) return;
                
                const startBar = startElement.bar;
                const endBar = endElement.bar;
                const startIsMilestone = startBar.classList.contains('milestone');
                const endIsMilestone = endBar.classList.contains('milestone');

                const startY = startElement.top + startBar.offsetHeight / 2;
                const endY = endElement.top + endBar.offsetHeight / 2;

                let startX, endX;
                const offset = 15;
                let d = '';

                if (dep.type === 'SS' || dep.type === 'SF') {
                    startX = startBar.offsetLeft;
                } else { 
                    startX = startBar.offsetLeft + (startIsMilestone ? startBar.offsetWidth / 2 : startBar.offsetWidth);
                }

                if (dep.type === 'FF' || dep.type === 'SF') {
                    endX = endBar.offsetLeft + (endIsMilestone ? endBar.offsetWidth / 2 : endBar.offsetWidth);
                } else { 
                    endX = endBar.offsetLeft;
                }
                
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                
                let intermediateX;
                switch (dep.type) {
                    case 'FS':
                        if (endX > startX + 5) {
                            intermediateX = startX + offset;
                             if(Math.abs(startY - endY) < 1) { 
                                d = `M ${startX} ${startY} H ${endX}`;
                            } else {
                                d = `M ${startX} ${startY} H ${intermediateX} V ${endY} H ${endX}`;
                            }
                        } else { 
                            d = `M ${startX} ${startY} H ${startX + offset} V ${endY - ROW_HEIGHT/2} H ${endX - offset} V ${endY} H ${endX}`;
                        }
                        break;
                    case 'SS':
                        intermediateX = Math.min(startX, endX) - offset;
                        d = `M ${startX} ${startY} H ${intermediateX} V ${endY} H ${endX}`;
                        break;
                    case 'FF':
                        intermediateX = Math.max(startX, endX) + offset;
                        d = `M ${startX} ${startY} H ${intermediateX} V ${endY} H ${endX}`;
                        break;
                    case 'SF':
                        intermediateX = endX - (endX - startX)/2;
                        d = `M ${startX} ${startY} H ${intermediateX} V ${endY} H ${endX}`;
                        break;
                    default: 
                        startX = startBar.offsetLeft + (startIsMilestone ? startBar.offsetWidth / 2 : startBar.offsetWidth);
                        endX = endBar.offsetLeft;
                        d = `M ${startX} ${startY} H ${endX - offset} V ${endY} H ${endX}`;
                        break;
                }
                
                path.setAttribute('d', d);
                path.style.stroke = connectorColor;
                path.style.strokeWidth = '1.5px';
                path.style.fill = 'none';
                path.setAttribute('marker-end', 'url(#arrowhead)');
                ganttConnectors.appendChild(path);
            });
        });
    };

    const makeBarDraggable = (barElement, task, projectStart, pixelsPerDay) => {
        barElement.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('resize-handle') || pixelsPerDay <= 0) return;
            e.preventDefault();
            const startX = e.clientX;
            const originalLeft = parseFloat(barElement.style.left);
            const originalStartDate = new Date(task.startDate);

            document.body.style.cursor = 'move';

            const handleMouseMove = (moveEvent) => {
                const deltaX = moveEvent.clientX - startX;
                barElement.style.left = `${originalLeft + deltaX}px`;
            };

            const handleMouseUp = (upEvent) => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
                document.body.style.cursor = 'default';

                const deltaX = upEvent.clientX - startX;
                const daysMoved = Math.round(deltaX / pixelsPerDay);
                
                if (daysMoved === 0) {
                   barElement.style.left = `${originalLeft}px`;
                   return;
                }

                const newStartDate = new Date(originalStartDate);
                newStartDate.setDate(originalStartDate.getDate() + daysMoved);
                const duration = getDuration(task.startDate, task.endDate);
                const newEndDate = new Date(newStartDate);
                newEndDate.setDate(newStartDate.getDate() + duration - 1);

                const formatDate = (d) => d.toISOString().split('T')[0];
                task.startDate = formatDate(newStartDate);
                task.endDate = formatDate(newEndDate);

                saveTasks();
                renderAll();
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        });
    };

    const makeBarResizable = (barElement, leftHandle, rightHandle, task, projectStart, pixelsPerDay) => {
        rightHandle.addEventListener('mousedown', (e) => {
            if (pixelsPerDay <= 0) return;
            e.stopPropagation();
            e.preventDefault();
            const startX = e.clientX;
            const originalWidth = parseFloat(barElement.style.width);
            document.body.style.cursor = 'ew-resize';

            const handleMouseMove = (moveEvent) => {
                const deltaX = moveEvent.clientX - startX;
                const newWidth = originalWidth + deltaX;
                if (newWidth > pixelsPerDay / 2) {
                    barElement.style.width = `${newWidth}px`;
                }
            };

            const handleMouseUp = (upEvent) => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
                document.body.style.cursor = 'default';

                const deltaX = upEvent.clientX - startX;
                const daysChanged = Math.round(deltaX / pixelsPerDay);

                if (daysChanged === 0) {
                   barElement.style.width = `${originalWidth}px`;
                   return;
                }

                const originalEndDate = new Date(task.endDate);
                const newEndDate = new Date(originalEndDate);
                newEndDate.setDate(originalEndDate.getDate() + daysChanged);
                const formatDate = (d) => d.toISOString().split('T')[0];
                
                if (new Date(task.startDate) > newEndDate) {
                    barElement.style.width = `${originalWidth}px`;
                    return; 
                }
                task.endDate = formatDate(newEndDate);
                saveTasks();
                renderAll();
            };
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        });

        leftHandle.addEventListener('mousedown', (e) => {
             if (pixelsPerDay <= 0) return;
            e.stopPropagation();
            e.preventDefault();
            const startX = e.clientX;
            const originalLeft = parseFloat(barElement.style.left);
            const originalWidth = parseFloat(barElement.style.width);
            document.body.style.cursor = 'ew-resize';

            const handleMouseMove = (moveEvent) => {
                const deltaX = moveEvent.clientX - startX;
                const newLeft = originalLeft + deltaX;
                const newWidth = originalWidth - deltaX;

                if (newWidth > pixelsPerDay / 2) {
                    barElement.style.left = `${newLeft}px`;
                    barElement.style.width = `${newWidth}px`;
                }
            };

            const handleMouseUp = (upEvent) => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
                document.body.style.cursor = 'default';

                const deltaX = upEvent.clientX - startX;
                const daysChanged = Math.round(deltaX / pixelsPerDay);

                if (daysChanged === 0) {
                   barElement.style.left = `${originalLeft}px`;
                   barElement.style.width = `${originalWidth}px`;
                   return;
                }
                
                const originalStartDate = new Date(task.startDate);
                const newStartDate = new Date(originalStartDate);
                newStartDate.setDate(originalStartDate.getDate() + daysChanged);
                const formatDate = (d) => d.toISOString().split('T')[0];
                
                if (newStartDate > new Date(task.endDate)) {
                    barElement.style.left = `${originalLeft}px`;
                    barElement.style.width = `${originalWidth}px`;
                    return;
                }
                task.startDate = formatDate(newStartDate);
                saveTasks();
                renderAll();
            };
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        });
    };

    ganttBodyContainer.addEventListener('scroll', () => {
        ganttHeaderContainer.scrollLeft = ganttBodyContainer.scrollLeft;
        ganttHeaderMajor.style.left = `-${ganttBodyContainer.scrollLeft}px`;
        ganttHeaderMinor.style.left = `-${ganttBodyContainer.scrollLeft}px`;
        gridRowsWrapper.style.transform = `translateY(-${ganttBodyContainer.scrollTop}px)`;
    });

    gridRowsWrapper.addEventListener('click', (e) => {
        const addChildBtn = e.target.closest('.add-child-btn');
        const toggleBtn = e.target.closest('.toggle-btn');
        const nameCell = e.target.closest('.col-name-cell');

        if (addChildBtn) {
            const taskId = parseInt(addChildBtn.dataset.taskId, 10);
            openModal(null, taskId);
        } else if (toggleBtn) {
            const taskId = parseInt(toggleBtn.dataset.taskId, 10);
            if (collapsedTasks.has(taskId)) {
                collapsedTasks.delete(taskId);
            } else {
                collapsedTasks.add(taskId);
            }
            renderAll();
        } else if (nameCell) {
            const taskId = parseInt(nameCell.dataset.taskId, 10);
            const taskToEdit = tasks.find(t => t.id === taskId);
            if(taskToEdit) {
                openModal(taskToEdit);
            }
        }
    });

    const handleFormSubmit = () => {
        const id = parseInt(taskIdInput.value, 10) || null;
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;

        if (!taskNameInput.value || !startDate || (taskTypeSelect.value !== 'milestone' && !endDate) ) {
            alert('Lütfen tüm zorunlu alanları doldurun (Başlık, Başlangıç, Bitiş).');
            return;
        }

        if (taskTypeSelect.value !== 'milestone' && new Date(endDate) < new Date(startDate)) {
            alert('Hata: Bitiş tarihi, başlangıç tarihinden önce olamaz.');
            return;
        }
        
        const parentId = parseInt(parentTaskSelect.value, 10);
        
        const predecessors = [];
        predecessorList.querySelectorAll('.predecessor-item').forEach(item => {
            const taskId = item.querySelector('.predecessor-task-select').value;
            const type = item.querySelector('.predecessor-type-select').value;
            if(taskId) {
                predecessors.push({ taskId: parseInt(taskId, 10), type });
            }
        });

        const assignedTo = [];
        assignedToDropdown.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
            assignedTo.push(parseInt(checkbox.dataset.id, 10));
        });

        const taskData = {
            name: taskNameInput.value,
            startDate: startDate,
            endDate: taskTypeSelect.value === 'milestone' ? startDate : endDate,
            assignedTo: assignedTo,
            parentId: parentId,
            progress: parseInt(progressInput.value, 10),
            type: taskTypeSelect.value,
            notes: notesInput.value,
            predecessors: predecessors,
        };
        
        const originalSuccessors = id ? tasks.filter(t => t.predecessors && t.predecessors.some(p => p.taskId === id)) : [];

        if (id) { 
            const taskIndex = tasks.findIndex(t => t.id === id);
            if (taskIndex > -1) {
                const existingTask = tasks[taskIndex];
                tasks[taskIndex] = { ...existingTask, ...taskData };
            }
        } else { 
            const parentTask = tasks.find(t => t.id === parentId);
            let newWbs;
            if (parentId === 0) {
                const topLevelWbsNumbers = tasks.filter(t => t && t.parentId === 0).map(t => parseInt(t.wbs, 10)).filter(n => !isNaN(n));
                const maxWbs = topLevelWbsNumbers.length > 0 ? Math.max(...topLevelWbsNumbers) : 0;
                newWbs = (maxWbs + 1).toString();
            } else {
                const parentWbs = parentTask.wbs;
                const childWbsParts = tasks.filter(t => t && t.parentId === parentId).map(t => {
                    const parts = t.wbs.split('.');
                    return parseInt(parts[parts.length - 1], 10);
                }).filter(n => !isNaN(n));
                const maxChildWbs = childWbsParts.length > 0 ? Math.max(...childWbsParts) : 0;
                newWbs = `${parentWbs}.${maxChildWbs + 1}`;
            }
            
            const newTask = {
                id: tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1,
                wbs: newWbs,
                ...taskData
            };
            tasks.push(newTask);
        }
        
        const newTaskId = id || (tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) : 1);

        const newSuccessorsFromUI = [];
        successorList.querySelectorAll('.successor-item').forEach(item => {
             const taskId = item.querySelector('.successor-task-select').value;
             const type = item.querySelector('.successor-type-select').value;
             if(taskId) {
                newSuccessorsFromUI.push({ taskId: parseInt(taskId, 10), type });
             }
        });

        newSuccessorsFromUI.forEach(succDep => {
            const successorTask = tasks.find(t => t.id === succDep.taskId);
            if (successorTask) {
                if (!successorTask.predecessors) successorTask.predecessors = [];
                const existingPredIndex = successorTask.predecessors.findIndex(p => p.taskId === newTaskId);
                if (existingPredIndex > -1) {
                    successorTask.predecessors[existingPredIndex].type = succDep.type;
                } else {
                    successorTask.predecessors.push({ taskId: newTaskId, type: succDep.type });
                }
            }
        });

        originalSuccessors.forEach(origSucc => {
            const stillExists = newSuccessorsFromUI.some(s => s.taskId === origSucc.id);
            if (!stillExists) {
                 const successorTask = tasks.find(t => t.id === origSucc.id);
                 if (successorTask && successorTask.predecessors) {
                    successorTask.predecessors = successorTask.predecessors.filter(p => p.taskId !== newTaskId);
                 }
            }
        });


        saveTasks();
        renderAll();
        closeModal();
    };

    saveTaskBtn.addEventListener('click', handleFormSubmit);

    deleteTaskBtn.addEventListener('click', () => {
        const id = parseInt(taskIdInput.value, 10);
        if(!id) return;
        if (confirm('Bu görevi ve tüm alt görevlerini silmek istediğinizden emin misiniz?')) {
            const idsToDelete = [id];
            const findChildrenRecursive = (parentId) => {
                tasks.filter(t => t.parentId === parentId).forEach(child => {
                    idsToDelete.push(child.id);
                    findChildrenRecursive(child.id);
                });
            };
            findChildrenRecursive(id);
            tasks = tasks.filter(t => !idsToDelete.includes(t.id));
            
            tasks.forEach(t => {
                if (t.predecessors) {
                    t.predecessors = t.predecessors.filter(p => !idsToDelete.includes(p.taskId));
                }
            });

            saveTasks();
            renderAll();
            closeModal();
        }
    });

    clearDataBtn.addEventListener('click', () => {
        if (confirm('Tüm proje verileri silinecek ve başlangıç verileri yüklenecek. Emin misiniz?')) {
            localStorage.removeItem('projectTasks');
            loadTasks();
            saveTasks();
            renderAll();
        }
    });
    const openModal = (task = null, parentIdForNewTask = null) => {
        taskForm.reset();
        const currentTaskId = task ? task.id : null;
        
        if (task) {
            modalTitle.textContent = 'Görevi Düzenle';
            taskIdInput.value = task.id;
            taskNameInput.value = task.name;
            taskTypeSelect.value = task.type || 'task';
            parentTaskSelect.value = task.parentId;
            startDateInput.value = task.startDate;
            endDateInput.value = task.endDate;
            progressInput.value = task.progress || 0;
            notesInput.value = task.notes || '';
            deleteTaskBtn.style.display = 'block';
            renderParentTaskOptions(currentTaskId);
            renderPredecessors(task.predecessors || []);
            renderSuccessors(task.id);
            renderAssigneeSelector(task.assignedTo || []);

        } else {
            modalTitle.textContent = 'Yeni Görev';
            taskIdInput.value = '';
            parentTaskSelect.value = parentIdForNewTask || 0;
            progressInput.value = 0;
            notesInput.value = '';
            deleteTaskBtn.style.display = 'none';
            renderParentTaskOptions();
            renderPredecessors([]);
            renderSuccessors(null);
            renderAssigneeSelector([]);
        }
        updateDuration();
        updateProgressUI();
        handleTaskTypeChange();
        taskModal.style.display = 'block';
    };
    
    const closeModal = () => {
        taskModal.style.display = 'none';
    };

    const renderParentTaskOptions = (currentTaskId) => {
        const selectedParent = parentTaskSelect.value;
        parentTaskSelect.innerHTML = '<option value="0">Ana Görev (Parent Yok)</option>';
        tasks.filter(t => t.type !== 'milestone' && t.id !== currentTaskId).forEach(task => {
            const option = document.createElement('option');
            option.value = task.id;
            option.textContent = `(${task.wbs}) ${task.name}`;
            parentTaskSelect.appendChild(option);
        });
        parentTaskSelect.value = selectedParent;
    };

    const renderPredecessors = (predecessors) => {
        predecessorList.innerHTML = '';
        const currentTaskId = parseInt(taskIdInput.value, 10);
        predecessors.forEach(pred => addPredecessorRow(pred, currentTaskId));
    };

    const addPredecessorRow = (predecessor = {}, currentTaskId) => {
        const item = document.createElement('div');
        item.className = 'predecessor-item';
        
        const taskSelect = document.createElement('select');
        taskSelect.className = 'predecessor-task-select';
        
        const availableTasks = tasks.filter(t => t.id !== currentTaskId);
        availableTasks.forEach(t => {
            const option = document.createElement('option');
            option.value = t.id;
            option.textContent = `(${t.wbs}) ${t.name}`;
            if (predecessor.taskId && t.id === predecessor.taskId) {
                option.selected = true;
            }
            taskSelect.appendChild(option);
        });

        const typeSelect = document.createElement('select');
        typeSelect.className = 'predecessor-type-select';
        typeSelect.innerHTML = `
            <option value="FS">Finish-to-Start (FS)</option>
            <option value="SS">Start-to-Start (SS)</option>
            <option value="FF">Finish-to-Finish (FF)</option>
            <option value="SF">Start-to-Finish (SF)</option>
        `;
        typeSelect.value = predecessor.type || 'FS';

        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '&times;';
        removeBtn.onclick = () => item.remove();
        
        item.appendChild(taskSelect);
        item.appendChild(typeSelect);
        item.appendChild(removeBtn);
        predecessorList.appendChild(item);
    };

    const renderSuccessors = (currentTaskId) => {
        successorList.innerHTML = '';
        if (!currentTaskId) {
            successorList.innerHTML = '<span style="color: #888; font-style: italic;">Yeni görev kaydedildikten sonra ardıllar eklenebilir.</span>';
            return;
        }

        const successorTasks = tasks.filter(t => t.predecessors && t.predecessors.some(p => p.taskId === currentTaskId));
        if (successorTasks.length === 0) {
            successorList.innerHTML = '<span style="color: #888; font-style: italic;">Bu görevi bekleyen başka bir görev bulunmuyor.</span>';
        } else {
             successorTasks.forEach(succ => {
                const dep = succ.predecessors.find(p => p.taskId === currentTaskId);
                addSuccessorRow({taskId: succ.id, type: dep.type}, currentTaskId);
            });
        }
    };

    const addSuccessorRow = (successor = {}, currentTaskId) => {
        const item = document.createElement('div');
        item.className = 'successor-item';
        
        const taskSelect = document.createElement('select');
        taskSelect.className = 'successor-task-select';
        
        const availableTasks = tasks.filter(t => t.id !== currentTaskId && (!t.predecessors || !t.predecessors.some(p => p.taskId === currentTaskId)));
        availableTasks.forEach(t => {
            const option = document.createElement('option');
            option.value = t.id;
            option.textContent = `(${t.wbs}) ${t.name}`;
            if (successor.taskId && t.id === successor.taskId) {
                option.selected = true;
            }
            taskSelect.appendChild(option);
        });

        const typeSelect = document.createElement('select');
        typeSelect.className = 'successor-type-select';
        typeSelect.innerHTML = `
            <option value="FS">Finish-to-Start (FS)</option>
            <option value="SS">Start-to-Start (SS)</option>
            <option value="FF">Finish-to-Finish (FF)</option>
            <option value="SF">Start-to-Finish (SF)</option>
        `;
        typeSelect.value = successor.type || 'FS';

        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '&times;';
        removeBtn.onclick = () => item.remove();
        
        item.appendChild(taskSelect);
        item.appendChild(typeSelect);
        item.appendChild(removeBtn);
        successorList.appendChild(item);

         if (successorList.querySelector('span')) {
            successorList.querySelector('span').remove();
        }
    };

    const renderAssigneeSelector = (assignedIds) => {
        assignedToDropdown.innerHTML = '';
        personnel.forEach(p => {
            const isChecked = assignedIds.includes(p.id);
            const item = document.createElement('div');
            item.className = 'assigned-to-item';
            item.innerHTML = `
                <input type="checkbox" id="person-${p.id}" data-id="${p.id}" ${isChecked ? 'checked' : ''} style="display:none;">
                <label for="person-${p.id}">
                    <img src="${p.avatarUrl}" class="avatar">
                    <span class="name">${p.name}</span>
                    <span class="role">${p.role}</span>
                </label>
            `;
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const checkbox = item.querySelector('input');
                checkbox.checked = !checkbox.checked;
                updateAssignedToDisplay();
            });
            assignedToDropdown.appendChild(item);
        });
        updateAssignedToDisplay();
    };

    const updateAssignedToDisplay = () => {
        assignedToDisplay.innerHTML = '';
        const selectedCheckboxes = assignedToDropdown.querySelectorAll('input:checked');
        if (selectedCheckboxes.length === 0) {
            assignedToDisplay.innerHTML = '<span style="color:#888;">Personel Seçin...</span>';
        } else {
            selectedCheckboxes.forEach(checkbox => {
                const person = personnel.find(p => p.id === parseInt(checkbox.dataset.id));
                if (person) {
                    const pill = document.createElement('span');
                    pill.className = 'assignee-pill';
                    pill.innerHTML = `<img src="${person.avatarUrl}" class="avatar"> ${person.name}`;
                    assignedToDisplay.appendChild(pill);
                }
            });
        }
    };

    addPredecessorBtn.addEventListener('click', () => {
        const currentTaskId = parseInt(taskIdInput.value, 10);
        addPredecessorRow(undefined, currentTaskId);
    });

    addSuccessorBtn.addEventListener('click', () => {
        const currentTaskId = parseInt(taskIdInput.value, 10);
        if(!currentTaskId) return;
        addSuccessorRow(undefined, currentTaskId);
    });

    assignedToDisplay.addEventListener('click', () => {
        assignedToDropdown.classList.toggle('show');
        assignedToDisplay.classList.toggle('open');
    });

    addTaskMainBtn.addEventListener('click', () => openModal());
    closeBtn.addEventListener('click', closeModal);

    const updateDuration = () => {
        const duration = getDuration(startDateInput.value, endDateInput.value);
        if (taskTypeSelect.value === 'milestone') {
             durationInput.value = 0;
        } else {
            durationInput.value = duration;
        }
    };
    const updateEndDate = () => {
        if(!startDateInput.value) return;
        const startDate = new Date(startDateInput.value);
        const duration = parseInt(durationInput.value, 10);
        if (isNaN(duration) || duration < 0) return;
        
        if (taskTypeSelect.value === 'milestone') {
            endDateInput.value = startDateInput.value;
        } else {
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + Math.max(0, duration - 1));
            endDateInput.value = endDate.toISOString().split('T')[0];
        }
    };
    const updateProgressUI = () => {
        progressValue.textContent = `${progressInput.value}%`;
    }
    const handleTaskTypeChange = () => {
        const isMilestone = taskTypeSelect.value === 'milestone';
        durationInput.disabled = isMilestone;
        endDateInput.disabled = isMilestone;
        if (isMilestone) {
            durationInput.value = 0;
            endDateInput.value = startDateInput.value;
        } else {
            updateDuration();
        }
    };

    startDateInput.addEventListener('input', () => {
        if (taskTypeSelect.value === 'milestone') {
            endDateInput.value = startDateInput.value;
        }
        updateDuration();
    });
    endDateInput.addEventListener('input', updateDuration);
    durationInput.addEventListener('input', updateEndDate);
    progressInput.addEventListener('input', updateProgressUI);
    taskTypeSelect.addEventListener('change', handleTaskTypeChange);

    viewModeControls.addEventListener('click', (e) => {
        if(e.target.tagName === 'BUTTON') {
            const newMode = e.target.dataset.mode;
            if(newMode !== currentViewMode) {
                currentViewMode = newMode;
                viewModeControls.querySelector('.active').classList.remove('active');
                e.target.classList.add('active');
                renderAll();
            }
        }
    });
    
    zoomInBtn.addEventListener('click', () => {
        zoomLevel = Math.min(zoomLevel + 5, 150);
        renderAll();
    });

    zoomOutBtn.addEventListener('click', () => {
        zoomLevel = Math.max(zoomLevel - 5, 10);
        renderAll();
    });

    const initColumnWidths = () => {
        const headerCells = gridHeader.querySelectorAll('.grid-cell[class*="col-"]');
        columnWidths = {}; 
        headerCells.forEach(cell => {
            const columnClass = Array.from(cell.classList).find(c => c.startsWith('col-') && c !== 'col-add');
            if (columnClass) {
                columnWidths[columnClass] = cell.offsetWidth;
            }
        });
    };

    const applyColumnWidths = () => {
        let totalWidth = 0;
        const addColumn = gridHeader.querySelector('.col-add');
        if (addColumn) totalWidth += addColumn.offsetWidth;

        Object.entries(columnWidths).forEach(([className, width]) => {
            const headerCell = gridHeader.querySelector(`.${className}`);
            const bodyCells = gridRowsWrapper.querySelectorAll(`.${className}`);
            if (headerCell) {
                headerCell.style.width = `${width}px`;
                headerCell.style.flex = `0 0 ${width}px`;
                totalWidth += width;
            }
            bodyCells.forEach(cell => {
                cell.style.width = `${width}px`;
                cell.style.flex = `0 0 ${width}px`;
            });
        });
        document.documentElement.style.setProperty('--grid-width', `${totalWidth}px`);
    };

    const initResizableColumns = () => {
        const resizers = gridHeader.querySelectorAll('.column-resizer');
        let startX, startWidth, column, columnClass;

        const onMouseMove = (e) => {
            const newWidth = startWidth + (e.clientX - startX);
            if (newWidth > 50) { 
                column.style.width = `${newWidth}px`;
                column.style.flex = `0 0 ${newWidth}px`;
                
                if (columnClass) {
                    const bodyCells = gridRowsWrapper.querySelectorAll(`.${columnClass}`);
                    bodyCells.forEach(cell => {
                        cell.style.width = `${newWidth}px`;
                        cell.style.flex = `0 0 ${newWidth}px`;
                    });
                }
                
                let totalWidth = 0;
                gridHeader.querySelectorAll('.grid-cell').forEach(cell => totalWidth += cell.offsetWidth);
                document.documentElement.style.setProperty('--grid-width', `${totalWidth}px`);
            }
        };

        const onMouseUp = (e) => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = 'default';
            if (columnClass) {
                columnWidths[columnClass] = column.offsetWidth;
            }
        };

        resizers.forEach(resizer => {
            resizer.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                column = e.target.parentElement;
                columnClass = Array.from(column.classList).find(c => c.startsWith('col-') && c !== 'col-add');
                
                startX = e.clientX;
                startWidth = column.offsetWidth;
                document.body.style.cursor = 'col-resize';
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        });
    };

    // --- Dropdown Menu Logic ---
    const handleMenuClick = (menu, e) => {
         e.preventDefault();
         const action = e.target.dataset.action;
         if (action) {
            alert(`"${e.target.textContent}" özelliği yakında eklenecektir.`);
            menu.style.display = 'none';
         }
    };
    importBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        exportMenu.style.display = 'none';
        importMenu.style.display = importMenu.style.display === 'block' ? 'none' : 'block';
    });
    exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        importMenu.style.display = 'none';
        exportMenu.style.display = exportMenu.style.display === 'block' ? 'none' : 'block';
    });
    importMenu.addEventListener('click', (e) => handleMenuClick(importMenu, e));
    exportMenu.addEventListener('click', (e) => handleMenuClick(exportMenu, e));
    
    // Global click listener to close menus and dropdowns
    window.addEventListener('click', (e) => {
        if (e.target !== importBtn) importMenu.style.display = 'none';
        if (e.target !== exportBtn) exportMenu.style.display = 'none';

        if (!assignedToWrapper.contains(e.target)) {
            assignedToDropdown.classList.remove('show');
            assignedToDisplay.classList.remove('open');
        }
        if (e.target == taskModal) {
            closeModal();
        }
    });

  // --- UYGULAMA BAŞLANGICI ---
  personnel = personnelData; // Verileri data.js'den al
  loadTasks();
  initColumnWidths();
  renderAll();
  initResizableColumns();
});