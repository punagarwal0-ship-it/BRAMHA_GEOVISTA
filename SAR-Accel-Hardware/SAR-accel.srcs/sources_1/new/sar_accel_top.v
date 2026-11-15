`timescale 1ns/1ps

// SAR-Accel streaming top level.
// Input images must be synchronized, row-major streams of equal dimensions.
// The line buffers emit complete interior windows only. To keep this first
// integration correct with fixed-latency stages and a one-entry output buffer,
// input pauses while each interior-window result is processed/transferred.
module sar_accel_top #(
    parameter IMAGE_WIDTH = 4,
    parameter IMAGE_HEIGHT = 4,
    parameter COORD_WIDTH = 16
) (
    input  wire                   clk,
    input  wire                   rst,
    input  wire                   start,
    input  wire                   valid_in,
    output wire                   ready_in,
    input  wire [7:0]             pixel1_in,
    input  wire [7:0]             pixel2_in,
    input  wire [7:0]             threshold,
    output wire                   busy,
    output wire                   done,
    output wire                   valid_out,
    input  wire                   ready_out,
    output wire [7:0]             enhanced_pixel,
    output wire                   change_pixel
);
    wire input_busy, input_done;
    wire accepted;
    wire [7:0] input_pixel1, input_pixel2;
    wire [COORD_WIDTH-1:0] input_x, input_y;
    wire frame_last;
    reg  processing_lock;
    reg  [7:0] threshold_frame;

    wire [7:0] a0,a1,a2,a3,a4,a5,a6,a7,a8;
    wire [7:0] b0,b1,b2,b3,b4,b5,b6,b7,b8;
    wire window_valid_a, window_valid_b;
    wire [7:0] median_a, median_b;
    wire median_valid_a, median_valid_b;
    wire detector_valid, detector_change;
    wire output_ready_in, output_done;
    reg last_window, last_median, last_change;
    wire inside_window;
    wire final_input_pixel;

    assign accepted = valid_in && ready_in;
    assign inside_window = (input_x >= 2) && (input_y >= 2);
    assign final_input_pixel = (input_x == IMAGE_WIDTH-1) &&
                               (input_y == IMAGE_HEIGHT-1);
    // The output stage raises done on the final transfer edge; mask the
    // internal lock during that pulse so the external status is consistent.
    assign busy = input_busy || (processing_lock && !output_done) || valid_out;
    assign done = output_done;

    sar_input_interface #(
        .IMAGE_WIDTH(IMAGE_WIDTH), .IMAGE_HEIGHT(IMAGE_HEIGHT),
        .COORD_WIDTH(COORD_WIDTH)
    ) input_if (
        .clk(clk), .rst(rst), .start(start), .valid_in(valid_in),
        .ready_in(ready_in), .pixel1_in(pixel1_in), .pixel2_in(pixel2_in),
        .pixel_ready(~processing_lock), .pixel_valid_out(),
        .pixel1_out(input_pixel1), .pixel2_out(input_pixel2),
        .x_out(input_x), .y_out(input_y), .frame_last(frame_last),
        .busy(input_busy), .done(input_done)
    );

    sar_line_buffer #(
        .IMAGE_WIDTH(IMAGE_WIDTH), .IMAGE_HEIGHT(IMAGE_HEIGHT),
        .COORD_WIDTH(COORD_WIDTH)
    ) line_buffer_a (
        .clk(clk), .rst(rst), .pixel_in(input_pixel1),
        .valid_in(accepted), .x(input_x), .y(input_y),
        .p0(a0), .p1(a1), .p2(a2), .p3(a3), .p4(a4), .p5(a5),
        .p6(a6), .p7(a7), .p8(a8), .window_valid(window_valid_a)
    );

    sar_line_buffer #(
        .IMAGE_WIDTH(IMAGE_WIDTH), .IMAGE_HEIGHT(IMAGE_HEIGHT),
        .COORD_WIDTH(COORD_WIDTH)
    ) line_buffer_b (
        .clk(clk), .rst(rst), .pixel_in(input_pixel2),
        .valid_in(accepted), .x(input_x), .y(input_y),
        .p0(b0), .p1(b1), .p2(b2), .p3(b3), .p4(b4), .p5(b5),
        .p6(b6), .p7(b7), .p8(b8), .window_valid(window_valid_b)
    );

    sar_speckle_filter filter_a (
        .clk(clk), .rst(rst), .p0(a0), .p1(a1), .p2(a2),
        .p3(a3), .p4(a4), .p5(a5), .p6(a6), .p7(a7), .p8(a8),
        .valid_in(window_valid_a), .pixel_out(median_a),
        .valid_out(median_valid_a)
    );

    sar_speckle_filter filter_b (
        .clk(clk), .rst(rst), .p0(b0), .p1(b1), .p2(b2),
        .p3(b3), .p4(b4), .p5(b5), .p6(b6), .p7(b7), .p8(b8),
        .valid_in(window_valid_b), .pixel_out(median_b),
        .valid_out(median_valid_b)
    );

    sar_change_detector change_detector (
        .clk(clk), .rst(rst), .pixel1(median_a), .pixel2(median_b),
        .threshold(threshold_frame),
        .valid_in(median_valid_a && median_valid_b),
        .change_out(detector_change), .valid_out(detector_valid)
    );

    sar_output_interface output_if (
        .clk(clk), .rst(rst), .enhanced_in(median_b),
        .change_in(detector_change), .last_in(last_change),
        .valid_in(detector_valid), .ready_in(output_ready_in),
        .enhanced_out(enhanced_pixel), .change_out(change_pixel),
        .valid_out(valid_out), .ready_out(ready_out), .done(output_done)
    );

    always @(posedge clk) begin
        if (rst) begin
            processing_lock <= 1'b0;
            threshold_frame <= 8'd0;
            last_window <= 1'b0;
            last_median <= 1'b0;
            last_change <= 1'b0;
        end else begin
            if (start && !busy)
                threshold_frame <= threshold;

            last_window <= accepted && inside_window && final_input_pixel;
            last_median <= last_window;
            last_change <= last_median;

            if (output_done)
                processing_lock <= 1'b0;
            else if (accepted && inside_window)
                processing_lock <= 1'b1;
        end
    end
endmodule
