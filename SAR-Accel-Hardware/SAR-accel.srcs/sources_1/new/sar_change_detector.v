`timescale 1ns/1ps

// Pixel-wise threshold change detector.
// change_out is registered one clock after a valid pixel pair is sampled.
module sar_change_detector (
    input  wire       clk,
    input  wire       rst,
    input  wire [7:0] pixel1,
    input  wire [7:0] pixel2,
    input  wire [7:0] threshold,
    input  wire       valid_in,
    output reg        change_out,
    output reg        valid_out
);
    wire [8:0] difference;
    assign difference = (pixel2 >= pixel1)
                      ? ({1'b0, pixel2} - {1'b0, pixel1})
                      : ({1'b0, pixel1} - {1'b0, pixel2});

    always @(posedge clk) begin
        if (rst) begin
            change_out <= 1'b0;
            valid_out  <= 1'b0;
        end else begin
            valid_out <= valid_in;
            if (valid_in)
                change_out <= (difference > {1'b0, threshold});
        end
    end
endmodule
