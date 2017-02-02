import { ElementRef, Component, ViewChild } from '@angular/core';
import { Content, NavController } from 'ionic-angular';

import *  as moment from 'moment';
import * as d3 from 'd3';

@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage {

  @ViewChild(Content) content: Content;

  // public properties
  billData: any[];
  billDueDate: string;
  billHistory: any[];
  billPeriod: any;
  billPeriodEnd: any;
  billPeriodCost: any;
  billPeriodText: string;
  tabView: string;

  //graph properties
  private area: any;
  private areaPath: any;
  private barChart: any;
  private barGradient: any;
  private contentViewHeight: number;
  private contentDimensions: any;
  private data: any;
  private dayDiff: any;
  private defs: any;
  private dispatch: any;
  private focus: any;
  private height: any;
  private ionBillSummaryCardHeight: any;
  private ionBillSummaryCardWidth: any;
  private ionBillSummaryCardHeaderHeight: any;
  private ionHeaderHeight: number;
  private margin: any;
  private svg: any;
  private viewEl: any;
  private zoom: any;
  private xScale: any;
  private x2: any;
  private yScale: any;
  private xDomain: any;
  private xAxis: any;
  private width: number;
  private yAxis: any;
  private yDomain: any;
  private scale: any;

  // barChart
  private barxScale;
  private baryScale;
  private baryAxis;

  constructor(
    private el: ElementRef,
    private navController: NavController) { }

  ngAfterViewInit() {
    this.initializeGraph();
  }

  initializeGraph() {
    // set data
    this.data = this.getData();
    // set view a graph dimensions
    this.contentDimensions = this.content.getContentDimensions();
    this.viewEl = d3.select(this.el.nativeElement);
    this.contentViewHeight = this.contentDimensions.scrollHeight;
    this.ionHeaderHeight = this.viewEl.select('ion-header').node().offsetHeight;
    this.svg = this.viewEl.select('#graph').append('svg');
    this.svg.attr('height', this.contentViewHeight - 200);
    this.margin = { top: 20, right: 40, bottom: 30, left: 40 };
    this.width = this.contentDimensions.contentWidth - this.margin.left - this.margin.right;
    this.height = +this.svg.attr("height") - this.margin.top - this.margin.bottom;

    this.svg.attr('width', this.contentDimensions.contentWidth);

    this.zoom;
    // setup scales
    this.xScale = d3.scaleTime().range([0, this.width]);
    this.x2 = d3.scaleTime().range([0, this.width]);
    this.yScale = d3.scaleLinear().range([this.height, 0]);

    // setup domain
    this.xDomain = d3.extent(this.data, (d:Point) => { return this.getDate(d); });
    this.yDomain = [0, d3.max(this.data, (d: Point) => { return d.kWh; })];

    this.xScale.domain(this.xDomain);
    this.yScale.domain(this.yDomain);
    this.x2.domain(this.xScale.domain());

    // setup axis
    this.xAxis = d3.axisBottom(this.xScale).tickSize(0),
      this.yAxis = d3.axisLeft(this.yScale).tickValues(this.yScale.domain()).ticks(3).tickSize(0);

    // get day range
    this.dayDiff = this.daydiff(this.xScale.domain()[0], this.xScale.domain()[1]);
    this.zoom = d3.zoom()
      .scaleExtent([1, this.dayDiff * 12])
      .translateExtent([[0, 0], [this.width, this.height]])
      .extent([[0, 0], [this.width, this.height]])
      .on("zoom", this.zoomed);

    this.area = d3.area()
      .curve(d3.curveMonotoneX)
      .x((d:Point) => { return this.xScale(this.getDate(d)); })
      .y0(this.height)
      .y1((d: Point) => { return this.yScale(d.kWh); });

      // set clipping mask here
    this.defs = this.svg.append("defs");
    this.defs.append("clipPath")
      .attr("id", "clip")
      .append("rect")
      .attr("width", this.width)
      .attr('transform', 'translate(0,-20)')
      .attr("height", this.height + 10);

    this.focus = this.svg.append("g")
      .attr("class", "focus")
      .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");

    this.barGradient = this.defs
      .append('linearGradient')
      .attr('id', 'bill-bar-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    this.barGradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#AAE8EC")
      .attr("stop-opacity", 1);

    this.barGradient.append("stop")
      .attr("offset", "50%")
      .attr("stop-color", "#C2EEDF")
      .attr("stop-opacity", 1);

    this.barGradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#E2F6D9")
      .attr("stop-opacity", 1);

    var areaPath = this.focus.append("path")
      .datum(this.data)
      .attr("class", "area")
      .attr('height', this.height)
      .attr('clip-path', 'url(#clip)')
      .attr("d", this.area)
      .style("fill", "black");

    this.focus.append("g")
      .attr("class", "axis axis--x axis--bar-chart")
      .attr("transform", "translate(0," + (this.height) + ")")
      .call(this.xAxis);

    // setup zoom on svg
    this.svg.call(this.zoom);
    // Assign Event listeners to buttons
  }

  /**
       * Utility Methods...
       */
  zoomed = () => {
    var diff,
      domain,
      minBuffer,
      maxBuffer,
      t;

    t = d3.event.transform;

    if (isNaN(t.k)) return;

    this.xScale.domain(t.rescaleX(this.x2).domain());
    diff = this.daydiff(this.xScale.domain()[0], this.xScale.domain()[1]);

    // Redraw Axis
    this.xAxis = d3.axisBottom(this.xScale).tickSize(0).tickFormat(d3.timeFormat('%e')).ticks(6);
    this.focus.select(".axis--x").call(this.xAxis);

    // Redraw Paths
    this.focus.select(".area").attr("d", this.area);
  }

  calculateCost(value) {
    return (value * .15);
  }

  daydiff(first, second) {
    return Math.round((second - first) / (1000 * 60 * 60 * 24));
  }

  getDate(d:Point) {
    return new Date(d.kDateTime);
  }

  getData() {
    return [{"kWh":625.08,"kDateTime":"2015-01-01T00:00:00-06:00"},{"kWh":542.57,"kDateTime":"2015-02-01T00:00:00-06:00"},{"kWh":577.83,"kDateTime":"2015-03-01T00:00:00-06:00"},{"kWh":814.62,"kDateTime":"2015-04-01T00:00:00-05:00"},{"kWh":2429.56,"kDateTime":"2015-05-01T00:00:00-05:00"},{"kWh":2484.93,"kDateTime":"2015-06-01T00:00:00-05:00"},{"kWh":2062.05,"kDateTime":"2015-07-01T00:00:00-05:00"},{"kWh":900.05,"kDateTime":"2015-08-01T00:00:00-05:00"},{"kWh":401.39,"kDateTime":"2015-09-01T00:00:00-05:00"},{"kWh":765.06,"kDateTime":"2015-10-01T00:00:00-05:00"},{"kWh":843.82,"kDateTime":"2015-11-01T00:00:00-05:00"},{"kWh":447.59,"kDateTime":"2015-12-01T00:00:00-06:00"},{"kWh":446.34,"kDateTime":"2016-01-01T00:00:00-06:00"},{"kWh":490.05,"kDateTime":"2016-02-01T00:00:00-06:00"},{"kWh":425.83,"kDateTime":"2016-03-01T00:00:00-06:00"},{"kWh":959.95,"kDateTime":"2016-04-01T00:00:00-05:00"},{"kWh":1437.54,"kDateTime":"2016-05-01T00:00:00-05:00"},{"kWh":2040.62,"kDateTime":"2016-06-01T00:00:00-05:00"},{"kWh":2083.82,"kDateTime":"2016-07-01T00:00:00-05:00"},{"kWh":1771.66,"kDateTime":"2016-08-01T00:00:00-05:00"},{"kWh":1021.25,"kDateTime":"2016-09-01T00:00:00-05:00"}];
  }
}

interface Point{
  kWh: number;
  kDateTime: string;
}
