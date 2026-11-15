`timescale 1ns/1ps

// 3x3 median filter. Inputs are ordered row-major:
// p0 p1 p2
// p3 p4 p5
// p6 p7 p8
// The output is registered one clock after a valid window is sampled.
module sar_speckle_filter (
    input  wire       clk,
    input  wire       rst,
    input  wire [7:0] p0, p1, p2, p3, p4, p5, p6, p7, p8,
    input  wire       valid_in,
    output reg  [7:0] pixel_out,
    output reg        valid_out
);
    reg [7:0] pixels [0:8];
    reg [3:0] rank_count [0:8];
    reg [7:0] median_comb;
    integer i, j;

    // Rank each input by counting values that sort before it. Ties are broken
    // by input index, ensuring every pixel receives a unique rank 0..8.
    // This uses parallel comparisons rather than a long serial compare/swap
    // chain. Rank four is the median.
    always @* begin
        pixels[0] = p0; pixels[1] = p1; pixels[2] = p2;
        pixels[3] = p3; pixels[4] = p4; pixels[5] = p5;
        pixels[6] = p6; pixels[7] = p7; pixels[8] = p8;
        for (i = 0; i < 9; i = i + 1) begin
            rank_count[i] = 4'd0;
            for (j = 0; j < 9; j = j + 1) begin
                if ((j != i) &&
                    ((pixels[j] < pixels[i]) ||
                     ((pixels[j] == pixels[i]) && (j < i)))) begin
                    rank_count[i] = rank_count[i] + 4'd1;
                end
            end
        end
        median_comb = 8'd0;
        for (i = 0; i < 9; i = i + 1) begin
            if (rank_count[i] == 4'd4)
                median_comb = pixels[i];
        end
    end

    always @(posedge clk) begin
        if (rst) begin
            pixel_out <= 8'd0;
            valid_out <= 1'b0;
        end else begin
            valid_out <= valid_in;
            if (valid_in)
                pixel_out <= median_comb;
        end
    end
endmodule
