/* *
 * X-range series module
 *
 * (c) 2010-2019 Torstein Honsi, Lars A. V. Cabrera
 *
 * License: www.highcharts.com/license
 */

'use strict';

import H from '../parts/Globals.js';

var base = H.seriesTypes.sankey.prototype;
H.seriesType(
    'orgchart',
    'sankey',
    {
        borderColor: '${palette.neutralColor60}',
        borderRadius: 3,
        linkRadius: 10,
        borderWidth: 1,
        dataLabels: {
            fit: true,
            nodeFormatter: function () {
                var html = '<table style="width: 100%; height: 100%; ' +
                    'border-collapse: collapse"><tr>';

                if (this.point.image) {
                    html += '<td style="width: 30%; padding: 0">' +
                        '<img src="' + this.point.image + '" style="' +
                        'min-width: 20px; max-width: 100%; max-height: ' +
                        (this.point.nodeHeight - 5) + // 2x padding + border
                        'px; border-radius: 50%">' +
                        '</td>';
                }

                html += '<td style="padding: 0; text-align: center">';

                if (this.point.name) {
                    html += '<h4 style="margin: 0">' + this.point.name +
                        '</h4>';
                }

                if (this.point.title) {
                    html += '<p style="margin: 0">' + (this.point.title || '') +
                        '</p>';
                }

                if (this.point.description) {
                    html += '<p style="opacity: 0.75; margin: 5px">' +
                        this.point.description + '</p>';
                }

                html += '</td>' +
                    '</tr></table>';
                return html;
            },
            style: {
                fontWeight: 'normal',
                fontSize: '13px'
            },
            useHTML: true
        },
        hangingIndent: 20,
        linkColor: '${palette.neutralColor60}',
        linkLineWidth: 1,
        nodeWidth: 50
    },
    {
        inverted: true,
        pointAttribs: function (point, state) {
            var attribs = base.pointAttribs.call(this, point, state);

            if (!point.isNode) {
                attribs.stroke = this.options.linkColor;
                attribs['stroke-width'] = this.options.linkLineWidth;
                delete attribs.fill;
            } else {
                if (this.options.borderRadius) {
                    attribs.r = this.options.borderRadius;
                }
            }
            return attribs;
        },

        createNode: function (id) {
            var node = base.createNode
                .call(this, id);

            // All nodes in an org chart are equal width
            node.getSum = function () {
                return 1;
            };

            return node;

        },

        createNodeColumn: function () {
            var column = base.createNodeColumn.call(this);

            // Wrap the offset function so that the hanging node's children are
            // aligned to their parent
            H.wrap(column, 'offset', function (proceed, node, factor) {
                var offset = proceed.call(this, node, factor);

                // Modify the default output if the parent's layout is 'hanging'
                if (node.hangsFrom) {
                    return {
                        absoluteTop: node.hangsFrom.nodeY
                    };
                }

                return offset;
            });

            return column;
        },

        translateNode: function (node, column) {
            base.translateNode.call(this, node, column);

            if (node.hangsFrom) {
                node.shapeArgs.height -= this.options.hangingIndent;
                if (!this.chart.inverted) {
                    node.shapeArgs.y += this.options.hangingIndent;
                }
            }
            node.nodeHeight = this.chart.inverted ?
                node.shapeArgs.width :
                node.shapeArgs.height;
        },

        // General function to apply corner radius to a path - can be lifted to
        // renderer or utilities if we need it elsewhere.
        curvedPath: function (path, r) {
            var d = [],
                i,
                x,
                y,
                x1,
                x2,
                y1,
                y2,
                directionX,
                directionY;

            for (i = 0; i < path.length; i++) {
                x = path[i][0];
                y = path[i][1];

                // moveTo
                if (i === 0) {
                    d.push('M', x, y);

                } else if (i === path.length - 1) {
                    d.push('L', x, y);

                // curveTo
                } else if (r) {
                    x1 = path[i - 1][0];
                    y1 = path[i - 1][1];
                    x2 = path[i + 1][0];
                    y2 = path[i + 1][1];

                    // Only apply to breaks
                    if (x1 !== x2 && y1 !== y2) {
                        directionX = x1 < x2 ? 1 : -1;
                        directionY = y1 < y2 ? 1 : -1;
                        d.push(
                            'L',
                            x - directionX * Math.min(Math.abs(x - x1), r),
                            y - directionY * Math.min(Math.abs(y - y1), r),
                            'C',
                            x,
                            y,
                            x,
                            y,
                            x + directionX * Math.min(Math.abs(x - x2), r),
                            y + directionY * Math.min(Math.abs(y - y2), r),
                        );
                    }

                // lineTo
                } else {
                    d.push('L', x, y);
                }
            }
            return d;

        },

        translateLink: function (point) {
            var fromNode = point.fromNode,
                toNode = point.toNode,
                crisp = Math.round(this.options.linkLineWidth) % 2 / 2,
                x1 = Math.floor(
                    fromNode.shapeArgs.x + fromNode.shapeArgs.width
                ) + crisp,
                y1 = Math.floor(
                    fromNode.shapeArgs.y + fromNode.shapeArgs.height / 2
                ) + crisp,
                x2 = Math.floor(toNode.shapeArgs.x) + crisp,
                y2 = Math.floor(
                    toNode.shapeArgs.y + toNode.shapeArgs.height / 2
                ) + crisp,
                xMiddle = Math.floor((x1 + x2) / 2) + crisp,
                hangingIndent = this.options.hangingIndent;

            if (this.chart.inverted) {
                x1 -= fromNode.shapeArgs.width;
                x2 += toNode.shapeArgs.width;
            }

            if (toNode.hangsFrom === fromNode) {
                if (this.chart.inverted) {
                    y1 = Math.floor(
                        fromNode.shapeArgs.y +
                        fromNode.shapeArgs.height -
                        hangingIndent / 2
                    ) + crisp;
                } else {
                    y1 = Math.floor(
                        fromNode.shapeArgs.y +
                        hangingIndent / 2
                    ) + crisp;

                }
                xMiddle = x2 = Math.floor(
                    toNode.shapeArgs.x + toNode.shapeArgs.width / 2
                ) + crisp;
            }

            point.plotY = 1;
            point.shapeType = 'path';
            point.shapeArgs = {
                d: this.curvedPath([
                    [x1, y1],
                    [xMiddle, y1],
                    [xMiddle, y2],
                    [x2, y2]
                ], this.options.linkRadius)
            };
        },

        alignDataLabel: function (point, dataLabel, options) {
            // Align the data label to the point graphic
            if (options.useHTML) {
                var width = point.shapeArgs.width,
                    height = point.shapeArgs.height,
                    padjust = this.options.borderWidth +
                        2 * this.options.dataLabels.padding;

                if (this.chart.inverted) {
                    width = height;
                    height = point.shapeArgs.width;
                }

                height -= padjust;
                width -= padjust;

                // Set the size of the surrounding div emulating `g`
                H.css(dataLabel.text.element.parentNode, {
                    width: width + 'px',
                    height: height + 'px'
                });

                // Set properties for the span emulating `text`
                H.css(dataLabel.text.element, {
                    left: 0,
                    top: 0,
                    width: '100%',
                    height: '100%',
                    overflow: 'hidden'
                });

                // The getBBox function is used in `alignDataLabel` to align
                // inside the box
                dataLabel.getBBox = function () {
                    return {
                        width: width,
                        height: height
                    };
                };
            }

            H.seriesTypes.column.prototype.alignDataLabel.apply(
                this,
                arguments
            );
        }
    }

);