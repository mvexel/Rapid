import * as PIXI from 'pixi.js';
import { DashLine } from '@rapideditor/pixi-dashed-line';
import { GlowFilter } from 'pixi-filters';
import { /* geomRotatePoints,*/ vecEqual, vecLength /*, vecSubtract */ } from '@rapid-sdk/math';

import { AbstractFeature } from './AbstractFeature';
import { lineToPoly } from './helpers';
import { prefs } from '../core/preferences';

const PARTIALFILLWIDTH = 32;


/**
 * PixiFeaturePolygon
 *
 * Properties you can access:
 *   `geometry`   PixiGeometry() class containing all the information about the geometry
 *   `style`      Object containing styling data
 *   `container`  PIXI.Container containing the display objects used to draw the polygon
 *   `lowRes`     PIXI.Sprite for a replacement graphic to display at low resolution
 *   `fill`       PIXI.Graphic for the fill (below)
 *   `stroke`     PIXI.Graphic for the stroke (above)
 *   `mask`       PIXI.Mesh for the mask (applied to fill)
 *
 *   (also all properties inherited from `AbstractFeature`)
 */
export class PixiFeaturePolygon extends AbstractFeature {

  /**
   * @constructor
   * @param  layer       The Layer that owns this Feature
   * @param  featureID   Unique string to use for the name of this Feature
   */
  constructor(layer, featureID) {
    super(layer, featureID);

    this.type = 'polygon';
    this._ssrdata = null;

    const lowRes = new PIXI.Sprite();
    lowRes.name = 'lowRes';
    lowRes.anchor.set(0.5, 0.5);  // middle, middle
    lowRes.visible = false;
    lowRes.interactive = true;
    this.lowRes = lowRes;

    const fill = new PIXI.Graphics();
    fill.name = 'fill';
    fill.interactive = true;
    fill.sortableChildren = false;
    this.fill = fill;

    const stroke = new PIXI.Graphics();
    stroke.name = 'stroke';
    stroke.interactive = false;
    stroke.interactiveChildren = false;
    stroke.sortableChildren = false;
    this.stroke = stroke;

    // When partially filling areas: we really want to define the mask as a line
    // drawn within the inside of the area shape.  Graphics defined as a line
    // _can_ be used as a mask, but they do not participate in his testing!
    // So we'll create the mask graphic and then copy its attributes into a mesh
    // which _does_ hit test properly.
    // (Ignore the default MeshMaterial - it won't be drawn anyway, it's a mask.)
    const mask = new PIXI.Mesh(null, new PIXI.MeshMaterial(PIXI.Texture.WHITE));
    mask.name = 'mask';
    mask.buttonMode = true;
    mask.interactive = true;
    mask.interactiveChildren = true;
    mask.visible = false;
    this.mask = mask;

    this.container.addChild(lowRes, fill, stroke, mask);
  }


  /**
   * destroy
   * Every Feature should have a destroy function that frees all the resources
   * Do not use the Feature after calling `destroy()`.
   */
  destroy() {
    super.destroy();
    this.lowRes = null;
    this.fill = null;
    this.mask = null;

    if (this._ssrdata) {
      delete this._ssrdata.ssr;
      delete this._ssrdata.origSsr;
      delete this._ssrdata.origAxis1;
      delete this._ssrdata.origAxis2;
      delete this._ssrdata.origCenter;
      delete this._ssrdata.shapeType;
      this._ssrdata = null;
    }
  }


  /**
   * update
   * @param  projection  Pixi projection to use for rendering
   * @param  zoom        Effective zoom to use for rendering
   */
  update(projection, zoom) {
    if (!this.dirty) return;  // nothing to do

    const wireframeMode = this.context.map().wireframeMode;

    //
    // GEOMETRY
    //

    if (this.geometry.dirty) {
      this.geometry.update(projection, zoom);

      // redo ssr (move more of this into PixiGeometry later)
      this._ssrdata = null;

      // We use the SSR to approximate a low resolution polygon at low zooms
      if (this.geometry.ssr?.poly) {
        // Calculate axes of symmetry to determine width, height
        // The shape's surrounding rectangle has 2 axes of symmetry.
        //
        //       1
        //   p1 /\              p1 = midpoint of poly[0]-poly[1]
        //     /\ \ q2          q1 = midpoint of poly[2]-poly[3]
        //   0 \ \/\
        //      \/\ \ 2         p2 = midpoint of poly[3]-poly[0]
        //    p2 \ \/           q2 = midpoint of poly[1]-poly[2]
        //        \/ q1
        //        3

        const poly = this.geometry.ssr.poly;
        const p1 = [(poly[0][0] + poly[1][0]) / 2, (poly[0][1] + poly[1][1]) / 2 ];
        const q1 = [(poly[2][0] + poly[3][0]) / 2, (poly[2][1] + poly[3][1]) / 2 ];
        const p2 = [(poly[3][0] + poly[0][0]) / 2, (poly[3][1] + poly[0][1]) / 2 ];
        const q2 = [(poly[1][0] + poly[2][0]) / 2, (poly[1][1] + poly[2][1]) / 2 ];
        const axis1 = [p1, q1];
        const axis2 = [p2, q2];
        const center = [ (p1[0] + q1[0]) / 2, (p1[1] + q1[1]) / 2 ];

        // Pick an appropriate lowRes sprite for this shape
        // Are the SSR corners part of the shape?
        const EPSILON = 0.1;
        let c0in, c1in, c2in, c3in;
        this.geometry.outer.forEach(point => {
          if (!c0in) c0in = vecEqual(point, poly[0], EPSILON);
          if (!c1in) c1in = vecEqual(point, poly[1], EPSILON);
          if (!c2in) c2in = vecEqual(point, poly[2], EPSILON);
          if (!c3in) c3in = vecEqual(point, poly[3], EPSILON);
        });
        const cornersInSSR = c0in || c1in || c2in || c3in;

        this._ssrdata = {
          ssr: this.geometry.ssr,
          origSsr: this.geometry.origSsr,
          origAxis1: axis1.map(coord => projection.invert(coord)),
          origAxis2: axis2.map(coord => projection.invert(coord)),
          origCenter: projection.invert(center),
          shapeType: (cornersInSSR ? 'square' : 'circle')
        };
      }
    }


/// I think syncFeatureClasses handles flipping the interactivity now..
//    // TODO: Move this inside the geometry.dirty block above.
//    // If we're drawing, we shouldn't be able to target ourselves.
//    if (this._drawing) {
//      this.container.interactive = false;
//      this.container.interactiveChildren = false;
//    }


    // Calculate bounds
    const [minX, minY] = this.geometry.extent.min;
    const [maxX, maxY] = this.geometry.extent.max;
    const [w, h] = [maxX - minX, maxY - minY];
    this.sceneBounds.x = minX;
    this.sceneBounds.y = minY;
    this.sceneBounds.width = w;
    this.sceneBounds.height = h;


    //
    // STYLE
    //

    const style = this._style;
    const textures = this.context.pixi.rapidTextures;
    const color = style.fill.color || 0xaaaaaa;
    const alpha = style.fill.alpha || 0.3;
    const pattern = style.fill.pattern;
    let texture = pattern && textures.get(pattern) || PIXI.Texture.WHITE;    // WHITE turns off the texture
    let shape;
// bhousel update 5/27/22:
// I've noticed that we can't use textures from a spritesheet for patterns,
// and it would be nice to figure out why

    const fillstyle = prefs('area-fill') || 'partial';
    let doPartialFill = !style.requireFill && (fillstyle === 'partial');

    // If this shape is so small that partial filling makes no sense, fill fully (faster?)
    const cutoff = (2 * PARTIALFILLWIDTH) + 5;
    if (w < cutoff || h < cutoff) {
      doPartialFill = false;
    }
    // If this shape is so small that texture filling makes no sense, skip it (faster?)
// bhousel update 5/27/22:
// I actually now think this doesn't matter and, if anything, using different
// textures may break up the batches.  Eventually we'll introduce some containers
// so that the scene is sorted by style, and we'll try to just keep similarly
// textured things together to improve batching performance.
    if (w < PARTIALFILLWIDTH || h < PARTIALFILLWIDTH) {
      texture = PIXI.Texture.WHITE;
    }

    // Cull really tiny shapes
    if (w < 4 && h < 4) {  // so tiny
      this.lod = 0;  // off
      this.visible = false;
      this.fill.visible = false;
      this.stroke.visible = false;
      this.mask.visible = false;
      this.lowRes.visible = false;

    // Very small, swap with lowRes sprite
    } else if (this._ssrdata && (w < 20 && h < 20)) {
      this.lod = 1;  // simplified
      this.visible = true;
      const ssrdata = this._ssrdata;
      this.fill.visible = false;
      this.stroke.visible = false;
      this.mask.visible = false;
      this.lowRes.visible = true;

      const filling = wireframeMode ? '-unfilled' : '';
      const textureName = `lowres${filling}-${ssrdata.shapeType}`;
      const [x, y] = projection.project(ssrdata.origCenter);
      const rotation = ssrdata.ssr.angle;
      const axis1 = ssrdata.origAxis1.map(coord => projection.project(coord));
      const axis2 = ssrdata.origAxis2.map(coord => projection.project(coord));
      const w = vecLength(axis1[0], axis1[1]);
      const h = vecLength(axis2[0], axis2[1]);

      this.lowRes.texture = textures.get(textureName) || PIXI.Texture.WHITE;
      this.lowRes.position.set(x, y);
      this.lowRes.scale.set(w / 10, h / 10);   // our sprite is 10x10
      this.lowRes.rotation = rotation;
      this.lowRes.tint = color;

    } else {
      this.lod = 2;  // full
      this.visible = true;
      this.fill.visible = true;
      this.stroke.visible = true;
      this.lowRes.visible = false;

      shape = {
        outer: new PIXI.Polygon(this.geometry.flatOuter),
        holes: (this.geometry.flatHoles || []).map(flatHole => new PIXI.Polygon(flatHole))
      };
    }

    //
    // redraw the shapes
    //

    // STROKE
    if (shape && this.stroke.visible) {
      this.stroke
        .clear()
        .lineStyle({
          alpha: 1,
          width: wireframeMode ? 1 : style.fill.width || 2,
          color: color,
        })
        .drawShape(shape.outer);

      shape.holes.forEach(hole => this.stroke.drawShape(hole));
    }

    // FILL
    if (wireframeMode) {
      this.fill.visible = false;
      this.fill.clear();
    }

    if (shape && this.fill.visible) {
      this.fill
        .clear()
        .beginTextureFill({
          alpha: alpha,
          color: color,
          texture: texture
        })
        .drawShape(shape.outer);

      if (shape.holes.length) {
        this.fill.beginHole();
        shape.holes.forEach(hole => this.fill.drawShape(hole));
        this.fill.endHole();
      }
      this.fill.endFill();

      if (doPartialFill) {   // mask around the inside edges of the fill with a line
        const maskSource = new PIXI.Graphics()
          .clear()
          .lineTextureStyle({
            alpha: 1,
            alignment: 0,  // inside (will do the right thing even for holes, as they are wound correctly)
            width: PARTIALFILLWIDTH,
            color: 0x000000,
            texture: PIXI.Texture.WHITE
          });

        maskSource.drawShape(shape.outer);
        if (shape.holes.length) {
          shape.holes.forEach(hole => maskSource.drawShape(hole));
        }

        // Compute the mask's geometry, then copy its attributes into the mesh's geometry
        // This lets us use the Mesh as the mask and properly hit test against it.
        maskSource.geometry.updateBatches(true);
        this.mask.geometry = new PIXI.Geometry()
          .addAttribute('aVertexPosition', maskSource.geometry.points, 2)
          .addAttribute('aTextureCoord', maskSource.geometry.uvs, 2)
          .addIndex(maskSource.geometry.indices);

        this.mask.visible = true;
        this.fill.mask = this.mask;

      } else {  // full fill - no mask
        this.mask.visible = false;
        this.fill.mask = null;
      }
    }

    this._styleDirty = false;
    this.updateHalo();
  }


  /**
   * updateHalo
   * Show/Hide halo
   */
  updateHalo() {
if (!this.geometry.flatOuter) return;  // no points?

    const showHover = (this.visible && this.hovered);
    const showSelect = (this.visible && this.selected);

    // Hover
    if (showHover) {
      if (!this.container.filters) {
        const glow = new GlowFilter({ distance: 15, outerStrength: 3, color: 0xffff00 });
        glow.resolution = 2;
        this.container.filters = [glow];
      }
    } else {
      if (this.container.filters) {
        this.container.filters = null;
      }
    }

    // Select
    if (showSelect) {
      if (!this.halo) {
        this.halo = new PIXI.Graphics();
        this.halo.name = `${this.id}-halo`;
        const mapUIContainer = this.scene.layers.get('map-ui').container;
        mapUIContainer.addChild(this.halo);
      }

      const HALO_STYLE = {
        alpha: 0.9,
        dash: [6, 3],
        width: 2,   // px
        color: 0xffff00
      };

// for now, just copy what PixiFeatureLine does
const hitStyle = {
  alignment: 0.5,  // middle of line
  color: 0x0,
  width: 16,
  alpha: 1.0,
  join: PIXI.LINE_JOIN.BEVEL,
  cap: PIXI.LINE_CAP.BUTT
};
const bufferdata = lineToPoly(this.geometry.flatOuter, hitStyle);

      this.halo.clear();
      const dl = new DashLine(this.halo, HALO_STYLE);
      if (bufferdata?.outer) {
        dl.drawPolygon(bufferdata.outer);
      }
    } else {
      if (this.halo) {
        this.halo.destroy({ children: true });
        this.halo = null;
      }
    }
  }


  /**
   * style
   * @param  obj  Style `Object` (contents depends on the Feature type)
   *
   * 'point' - see PixiFeaturePoint.js
   * 'line'/'polygon' - see styles.js
   */
  get style() {
    return this._style;
  }
  set style(obj) {
    this._style = Object.assign({}, STYLE_DEFAULTS, obj);
    this._styleDirty = true;
  }

}


const STYLE_DEFAULTS = {
  requireFill: false,      // allow partial fill or wireframe styles
  lineMarkerName: '',
  lineMarkerTint: 0x000000,
  labelTint: 0xeeeeee,

  fill:   { width: 2, color: 0xaaaaaa, alpha: 0.3 },
  casing: { width: 5, color: 0x444444, alpha: 1, cap: PIXI.LINE_CAP.ROUND, join: PIXI.LINE_JOIN.ROUND },
  stroke: { width: 3, color: 0xcccccc, alpha: 1, cap: PIXI.LINE_CAP.ROUND, join: PIXI.LINE_JOIN.ROUND }
};
