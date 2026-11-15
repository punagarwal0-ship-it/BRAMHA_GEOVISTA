`timescale 1ns/1ps

// Streaming 3x3 window generator for row-major grayscale pixels.
// Only complete interior windows are emitted. A valid window is centered at
// coordinate (x-1,y-1) when the accepted input is at (x,y), x>=2 and y>=2.
// The caller must supply every pixel in order; valid_in may insert bubbles.
module sar_line_buffer #(
    parameter IMAGE_WIDTH = 4,
    parameter IMAGE_HEIGHT = 4,
    parameter COORD_WIDTH = 16
) (
    input  wire                  clk,
    input  wire                  rst,
    input  wire [7:0]            pixel_in,
    input  wire                  valid_in,
    input  wire [COORD_WIDTH-1:0] x,
    input  wire [COORD_WIDTH-1:0] y,
    output reg  [7:0]            p0, p1, p2,
    output reg  [7:0]            p3, p4, p5,
    output reg  [7:0]            p6, p7, p8,
    output reg                   window_valid
);
    // line1 stores the preceding row; line2 stores the row before that.
    // These arrays are intentionally not reset so synthesis can infer memory.
    reg [7:0] line1 [0:IMAGE_WIDTH-1];
    reg [7:0] line2 [0:IMAGE_WIDTH-1];

    // Two previous columns for each of the three rows in the active window.
    reg [7:0] top_d1, top_d2;
    reg [7:0] mid_d1, mid_d2;
    reg [7:0] bot_d1, bot_d2;

    always @(posedge clk) begin
        if (rst) begin
            p0 <= 8'd0; p1 <= 8'd0; p2 <= 8'd0;
            p3 <= 8'd0; p4 <= 8'd0; p5 <= 8'd0;
            p6 <= 8'd0; p7 <= 8'd0; p8 <= 8'd0;
            top_d1 <= 8'd0; top_d2 <= 8'd0;
            mid_d1 <= 8'd0; mid_d2 <= 8'd0;
            bot_d1 <= 8'd0; bot_d2 <= 8'd0;
            window_valid <= 1'b0;
        end else begin
            window_valid <= 1'b0;
            if (valid_in && (x < IMAGE_WIDTH) && (y < IMAGE_HEIGHT)) begin
                // Nonblocking assignments preserve the previous-row values
                // for this window while advancing the two line memories.
                line2[x] <= line1[x];
                line1[x] <= pixel_in;

                if ((x >= 2) && (y >= 2)) begin
                    p0 <= top_d2; p1 <= top_d1; p2 <= line2[x];
                    p3 <= mid_d2; p4 <= mid_d1; p5 <= line1[x];
                    p6 <= bot_d2; p7 <= bot_d1; p8 <= pixel_in;
                    window_valid <= 1'b1;
                end

                top_d2 <= top_d1; top_d1 <= line2[x];
                mid_d2 <= mid_d1; mid_d1 <= line1[x];
                bot_d2 <= bot_d1; bot_d1 <= pixel_in;
            end
        end
    end
endmodule
